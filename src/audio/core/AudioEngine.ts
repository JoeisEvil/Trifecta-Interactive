/**
 * Sonance Audio Engine - Main Controller
 * Manages AudioContext, sounds, listener, and master effects
 */

import type {
  AudioEngineConfig,
  AudioEngineState,
  SoundConfig,
} from './types';
import { DEFAULT_ENGINE_CONFIG, MIN_VOLUME, MAX_VOLUME } from './constants';
import { Sound } from '../spatial/Sound';
import { Listener } from '../spatial/Listener';
import { clamp } from '../utils/mathUtils';
import { generateHallReverb } from '../utils/reverbGenerator';
import type { Camera } from 'three';

export class AudioEngine {
  private context: AudioContext | null = null;
  private _listener: Listener | null = null;
  private masterGainNode: GainNode | null = null;

  // Reverb chain
  private dryGainNode: GainNode | null = null;
  private wetGainNode: GainNode | null = null;
  private convolverNode: ConvolverNode | null = null;

  private sounds: Map<string, Sound> = new Map();
  private config: Required<AudioEngineConfig>;
  private _state: AudioEngineState = 'suspended';
  private gestureHandler: (() => void) | null = null;

  constructor(config?: AudioEngineConfig) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
  }

  /**
   * Initialize the audio engine
   */
  async init(): Promise<void> {
    if (this.context) {
      console.warn('AudioEngine already initialized');
      return;
    }

    this.context = new AudioContext();
    this._state = this.context.state as AudioEngineState;

    // Create master gain (sounds connect here)
    this.masterGainNode = this.context.createGain();
    this.masterGainNode.gain.value = this.config.masterVolume;

    // Create dry path
    this.dryGainNode = this.context.createGain();
    this.dryGainNode.gain.value = this.config.reverbDry;

    // Create wet path (reverb)
    this.convolverNode = this.context.createConvolver();
    this.convolverNode.buffer = generateHallReverb(this.context, 2.0);

    this.wetGainNode = this.context.createGain();
    this.wetGainNode.gain.value = this.config.reverbWet;

    // Connect signal chain:
    // masterGain -> dryGain -> destination
    // masterGain -> convolver -> wetGain -> destination
    this.masterGainNode.connect(this.dryGainNode);
    this.dryGainNode.connect(this.context.destination);

    this.masterGainNode.connect(this.convolverNode);
    this.convolverNode.connect(this.wetGainNode);
    this.wetGainNode.connect(this.context.destination);

    // Create listener
    this._listener = new Listener(this.context);

    // Set up auto-resume on user gesture
    if (this.config.autoResume && this._state === 'suspended') {
      this.setupGestureResume();
    }

    // Listen for context state changes
    this.context.onstatechange = () => {
      if (this.context) {
        this._state = this.context.state as AudioEngineState;
      }
    };

    console.log(`AudioEngine initialized (state: ${this._state})`);
  }

  /**
   * Resume the audio context (call on user gesture)
   */
  async resume(): Promise<void> {
    if (!this.context) {
      throw new Error('AudioEngine not initialized');
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
      this._state = 'running';
      console.log('AudioEngine resumed');
    }
  }

  /**
   * Suspend the audio context
   */
  async suspend(): Promise<void> {
    if (!this.context) {
      throw new Error('AudioEngine not initialized');
    }

    if (this.context.state === 'running') {
      await this.context.suspend();
      this._state = 'suspended';
    }
  }

  /**
   * Dispose and clean up the engine
   */
  async dispose(): Promise<void> {
    this.removeGestureHandler();

    // Dispose all sounds
    for (const sound of this.sounds.values()) {
      sound.dispose();
    }
    this.sounds.clear();

    // Disconnect all nodes
    this.masterGainNode?.disconnect();
    this.dryGainNode?.disconnect();
    this.wetGainNode?.disconnect();
    this.convolverNode?.disconnect();

    this.masterGainNode = null;
    this.dryGainNode = null;
    this.wetGainNode = null;
    this.convolverNode = null;

    // Close context
    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    this._listener = null;
    this._state = 'closed';
    console.log('AudioEngine disposed');
  }

  /**
   * Get the AudioContext
   */
  getContext(): AudioContext {
    if (!this.context) {
      throw new Error('AudioEngine not initialized');
    }
    return this.context;
  }

  /**
   * Get the Listener
   */
  get listener(): Listener {
    if (!this._listener) {
      throw new Error('AudioEngine not initialized');
    }
    return this._listener;
  }

  /**
   * Get current engine state
   */
  get state(): AudioEngineState {
    return this._state;
  }

  /**
   * Check if engine is ready to play audio
   */
  get isReady(): boolean {
    return this._state === 'running';
  }

  /**
   * Get master volume
   */
  get masterVolume(): number {
    return this.masterGainNode?.gain.value ?? this.config.masterVolume;
  }

  /**
   * Set master volume
   */
  set masterVolume(value: number) {
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = clamp(value, MIN_VOLUME, MAX_VOLUME);
    }
  }

  /**
   * Get reverb wet level
   */
  get reverbWet(): number {
    return this.wetGainNode?.gain.value ?? this.config.reverbWet;
  }

  /**
   * Set reverb wet level (0-1)
   */
  set reverbWet(value: number) {
    if (this.wetGainNode) {
      this.wetGainNode.gain.value = clamp(value, MIN_VOLUME, MAX_VOLUME);
    }
  }

  /**
   * Get reverb dry level
   */
  get reverbDry(): number {
    return this.dryGainNode?.gain.value ?? this.config.reverbDry;
  }

  /**
   * Set reverb dry level (0-1)
   */
  set reverbDry(value: number) {
    if (this.dryGainNode) {
      this.dryGainNode.gain.value = clamp(value, MIN_VOLUME, MAX_VOLUME);
    }
  }

  /**
   * Set reverb mix (0 = fully dry, 1 = fully wet)
   */
  setReverbMix(mix: number): void {
    const clampedMix = clamp(mix, 0, 1);
    this.reverbDry = 1 - clampedMix * 0.5; // Reduce dry slightly as wet increases
    this.reverbWet = clampedMix;
  }

  /**
   * Create a new sound
   */
  createSound(id: string, config: SoundConfig): Sound {
    if (!this.context || !this.masterGainNode) {
      throw new Error('AudioEngine not initialized');
    }

    if (this.sounds.has(id)) {
      console.warn(`Sound with id "${id}" already exists, replacing`);
      this.removeSound(id);
    }

    const sound = new Sound(this.context, this.masterGainNode, config);
    this.sounds.set(id, sound);
    return sound;
  }

  /**
   * Get a sound by ID
   */
  getSound(id: string): Sound | undefined {
    return this.sounds.get(id);
  }

  /**
   * Remove and dispose a sound
   */
  removeSound(id: string): void {
    const sound = this.sounds.get(id);
    if (sound) {
      sound.dispose();
      this.sounds.delete(id);
    }
  }

  /**
   * Get all sound IDs
   */
  getSoundIds(): string[] {
    return Array.from(this.sounds.keys());
  }

  /**
   * Update listener position from camera (call each frame)
   */
  updateListener(camera: Camera): void {
    if (this._listener) {
      this._listener.syncWithCamera(camera);
    }
  }

  /**
   * Stop all sounds
   */
  stopAllSounds(): void {
    for (const sound of this.sounds.values()) {
      sound.stop();
    }
  }

  private setupGestureResume(): void {
    this.gestureHandler = () => {
      this.resume().catch(console.error);
      this.removeGestureHandler();
    };

    const events = ['click', 'touchstart', 'keydown'];
    events.forEach((event) => {
      document.addEventListener(event, this.gestureHandler!, { once: true });
    });
  }

  private removeGestureHandler(): void {
    if (this.gestureHandler) {
      const events = ['click', 'touchstart', 'keydown'];
      events.forEach((event) => {
        document.removeEventListener(event, this.gestureHandler!);
      });
      this.gestureHandler = null;
    }
  }
}
