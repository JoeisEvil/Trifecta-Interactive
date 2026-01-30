/**
 * Sonance Audio Engine - 3D Spatial Sound
 * Wraps PannerNode + GainNode for positioned audio
 * Supports seamless crossfade looping
 */

import type { SoundConfig, SoundState, SpatialConfig, Vector3 } from '../core/types';
import {
  DEFAULT_SPATIAL_CONFIG,
  DEFAULT_VOLUME,
  DEFAULT_LOOP,
  DEFAULT_FADE_DURATION,
  CLICK_FREE_FADE_DURATION,
  MIN_VOLUME,
  MAX_VOLUME,
} from '../core/constants';
import { clamp } from '../utils/mathUtils';
import { loadAudioBuffer, removeFromCache } from '../utils/audioLoader';

interface SourceWithGain {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class Sound {
  private context: AudioContext;
  private masterGain: GainNode;
  private config: SoundConfig;
  private spatialConfig: Required<SpatialConfig>;

  private buffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private pannerNode: PannerNode;

  // Crossfade looping
  private crossfadeDuration: number;
  private crossfadeSources: SourceWithGain[] = [];
  private loopSchedulerId: number | null = null;
  private nextLoopTime: number = 0;

  private _state: SoundState = 'stopped';
  private _volume: number;
  private _loop: boolean;
  private _offset: number;
  private _isLoaded: boolean = false;
  private stopTimeoutId: number | null = null;

  public onEnded?: () => void;
  public onLoaded?: () => void;
  public onError?: (error: Error) => void;

  constructor(
    context: AudioContext,
    masterGain: GainNode,
    config: SoundConfig
  ) {
    this.context = context;
    this.masterGain = masterGain;
    this.config = config;

    this._volume = config.volume ?? DEFAULT_VOLUME;
    this._loop = config.loop ?? DEFAULT_LOOP;
    this._offset = config.offset ?? 0;
    this.crossfadeDuration = config.crossfadeDuration ?? 0;

    this.spatialConfig = {
      ...DEFAULT_SPATIAL_CONFIG,
      ...config.spatial,
    };

    // Create gain node
    this.gainNode = context.createGain();
    this.gainNode.gain.value = this._volume;

    // Create panner node
    this.pannerNode = context.createPanner();
    this.applyPannerConfig();

    // Connect: gainNode -> pannerNode -> masterGain
    this.gainNode.connect(this.pannerNode);
    this.pannerNode.connect(this.masterGain);
  }

  /**
   * Load the audio buffer from URL
   */
  async load(): Promise<void> {
    try {
      this.buffer = await loadAudioBuffer(this.context, this.config.url);
      this._isLoaded = true;
      this.onLoaded?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.onError?.(err);
      throw err;
    }
  }

  /**
   * Play the sound
   */
  play(): void {
    if (!this.buffer) {
      console.warn('Sound.play(): Buffer not loaded');
      return;
    }

    // Cancel any pending fade-out stop
    if (this.stopTimeoutId !== null) {
      clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }

    // Stop any existing playback
    this.stopSourceImmediate();
    this.stopCrossfadeLoop();

    // Restore gain to target volume
    const now = this.context.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(this._volume, now);

    // Use crossfade looping if configured
    if (this._loop && this.crossfadeDuration > 0) {
      this.startCrossfadeLoop();
    } else {
      this.startSimplePlayback();
    }

    this._state = 'playing';
  }

  /**
   * Simple playback (native loop or one-shot)
   */
  private startSimplePlayback(): void {
    if (!this.buffer) return;

    this.sourceNode = this.context.createBufferSource();
    this.sourceNode.buffer = this.buffer;
    this.sourceNode.loop = this._loop;

    // Set loop points if using offset
    if (this._loop && this._offset > 0) {
      this.sourceNode.loopStart = this._offset;
      this.sourceNode.loopEnd = this.buffer.duration;
    }

    this.sourceNode.connect(this.gainNode);

    this.sourceNode.onended = () => {
      if (this._state === 'playing' && !this._loop) {
        this._state = 'stopped';
        this.onEnded?.();
      }
    };

    this.sourceNode.start(0, this._offset);
  }

  /**
   * Start crossfade looping for seamless loops
   */
  private startCrossfadeLoop(): void {
    if (!this.buffer) return;

    const loopDuration = this.buffer.duration - this._offset;
    const now = this.context.currentTime;

    // Start first source
    this.scheduleLoopSource(now, true);

    // Schedule subsequent loops using setInterval for reliability
    this.nextLoopTime = now + loopDuration - this.crossfadeDuration;
    this.loopSchedulerId = window.setInterval(this.schedulerTick, 100);
  }

  /**
   * Schedule a single loop source with fade
   */
  private scheduleLoopSource(startTime: number, isFirst: boolean): void {
    if (!this.buffer) return;

    const sourceGain = this.context.createGain();
    const source = this.context.createBufferSource();

    source.buffer = this.buffer;
    source.connect(sourceGain);
    sourceGain.connect(this.gainNode);

    const loopDuration = this.buffer.duration - this._offset;

    if (isFirst) {
      // First source: start at full volume
      sourceGain.gain.setValueAtTime(1, startTime);
    } else {
      // Subsequent sources: fade in
      sourceGain.gain.setValueAtTime(0, startTime);
      sourceGain.gain.linearRampToValueAtTime(1, startTime + this.crossfadeDuration);
    }

    // Fade out at end
    const fadeOutStart = startTime + loopDuration - this.crossfadeDuration;
    sourceGain.gain.setValueAtTime(1, fadeOutStart);
    sourceGain.gain.linearRampToValueAtTime(0, fadeOutStart + this.crossfadeDuration);

    source.start(startTime, this._offset);
    source.stop(startTime + loopDuration + 0.1); // Small buffer past fade

    // Track for cleanup
    const entry: SourceWithGain = { source, gain: sourceGain };
    this.crossfadeSources.push(entry);

    // Clean up after playback
    source.onended = () => {
      const idx = this.crossfadeSources.indexOf(entry);
      if (idx !== -1) {
        this.crossfadeSources.splice(idx, 1);
      }
      sourceGain.disconnect();
    };
  }

  /**
   * Scheduler tick for crossfade looping (called by setInterval)
   */
  private schedulerTick = (): void => {
    // Stop interval if no longer playing
    if (this._state !== 'playing' || !this._loop) {
      this.stopCrossfadeLoop();
      return;
    }

    const now = this.context.currentTime;
    const lookAhead = 1.0; // Schedule 1 second ahead for reliability

    // Schedule next loop if within look-ahead window
    while (this.nextLoopTime < now + lookAhead) {
      this.scheduleLoopSource(this.nextLoopTime, false);
      const loopDuration = (this.buffer?.duration ?? 0) - this._offset;
      this.nextLoopTime += loopDuration - this.crossfadeDuration;
    }
  };

  /**
   * Stop crossfade loop
   */
  private stopCrossfadeLoop(): void {
    if (this.loopSchedulerId !== null) {
      clearInterval(this.loopSchedulerId);
      this.loopSchedulerId = null;
    }

    // Stop and disconnect all crossfade sources
    for (const { source, gain } of this.crossfadeSources) {
      try {
        source.stop();
      } catch {
        // Ignore
      }
      source.disconnect();
      gain.disconnect();
    }
    this.crossfadeSources = [];
  }

  /**
   * Stop the sound with a short fade to prevent clicks
   */
  stop(fadeOut: number = CLICK_FREE_FADE_DURATION): void {
    if (this._state !== 'playing') {
      return;
    }

    const now = this.context.currentTime;

    // Cancel any existing automation and fade to zero
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
    this.gainNode.gain.linearRampToValueAtTime(0, now + fadeOut);

    // Schedule the actual stop after fade completes
    this._state = 'stopped';
    this.stopTimeoutId = window.setTimeout(() => {
      this.stopSourceImmediate();
      this.stopCrossfadeLoop();
      this.stopTimeoutId = null;
    }, fadeOut * 1000 + 10);
  }

  /**
   * Pause the sound (implemented as fade-out stop since AudioBufferSourceNode can't pause)
   */
  pause(): void {
    if (this._state === 'playing') {
      this.stop();
      this._state = 'paused';
    }
  }

  /**
   * Fade volume to target over duration
   */
  fadeTo(targetVolume: number, duration: number = DEFAULT_FADE_DURATION): void {
    const target = clamp(targetVolume, MIN_VOLUME, MAX_VOLUME);
    const now = this.context.currentTime;

    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
    this.gainNode.gain.linearRampToValueAtTime(target, now + duration);
    this._volume = target;
  }

  /**
   * Set 3D position
   */
  setPosition(x: number, y: number, z: number): void {
    this.spatialConfig.position = { x, y, z };
    this.applyPosition();
  }

  /**
   * Get current 3D position
   */
  getPosition(): Vector3 {
    return { ...this.spatialConfig.position };
  }

  /**
   * Get volume (0-1)
   */
  get volume(): number {
    return this._volume;
  }

  /**
   * Set volume (0-1)
   */
  set volume(value: number) {
    this._volume = clamp(value, MIN_VOLUME, MAX_VOLUME);
    this.gainNode.gain.value = this._volume;
  }

  /**
   * Get loop state
   */
  get loop(): boolean {
    return this._loop;
  }

  /**
   * Set loop state
   */
  set loop(value: boolean) {
    this._loop = value;
    if (this.sourceNode) {
      this.sourceNode.loop = value;
    }
  }

  /**
   * Get current state
   */
  get state(): SoundState {
    return this._state;
  }

  /**
   * Check if loaded
   */
  get isLoaded(): boolean {
    return this._isLoaded;
  }

  /**
   * Check if playing
   */
  get isPlaying(): boolean {
    return this._state === 'playing';
  }

  /**
   * Dispose and clean up resources
   */
  dispose(): void {
    // Clear any pending timeouts
    if (this.stopTimeoutId !== null) {
      clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }

    this.stopSourceImmediate();
    this.stopCrossfadeLoop();
    this.gainNode.disconnect();
    this.pannerNode.disconnect();
    this.buffer = null;
    this._isLoaded = false;

    removeFromCache(this.config.url);
  }

  private stopSourceImmediate(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {
        // Ignore if already stopped
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
  }

  private applyPannerConfig(): void {
    const panner = this.pannerNode;
    const config = this.spatialConfig;

    panner.panningModel = config.panningModel;
    panner.distanceModel = config.distanceModel;
    panner.refDistance = config.refDistance;
    panner.maxDistance = config.maxDistance;
    panner.rolloffFactor = config.rolloffFactor;
    panner.coneInnerAngle = config.coneInnerAngle;
    panner.coneOuterAngle = config.coneOuterAngle;
    panner.coneOuterGain = config.coneOuterGain;

    this.applyPosition();
  }

  private applyPosition(): void {
    const { x, y, z } = this.spatialConfig.position;
    const panner = this.pannerNode;

    if (panner.positionX !== undefined) {
      panner.positionX.value = x;
      panner.positionY.value = y;
      panner.positionZ.value = z;
    } else {
      (panner as any).setPosition(x, y, z);
    }
  }
}
