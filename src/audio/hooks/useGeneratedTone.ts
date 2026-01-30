/**
 * Sonance Audio Engine - useGeneratedTone Hook
 * Creates a spatial sound using a programmatically generated tone
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AudioEngine } from '../core/AudioEngine';
import type { SoundState, SpatialConfig } from '../core/types';
import { generateToneBuffer, ToneOptions } from '../utils/toneGenerator';
import { CLICK_FREE_FADE_DURATION } from '../core/constants';

export interface UseGeneratedToneConfig {
  tone?: ToneOptions;
  volume?: number;
  loop?: boolean;
  spatial?: SpatialConfig;
}

export interface UseGeneratedToneResult {
  play: () => void;
  stop: () => void;
  setPosition: (x: number, y: number, z: number) => void;
  setVolume: (volume: number) => void;
  isReady: boolean;
  isPlaying: boolean;
  state: SoundState;
}

export function useGeneratedTone(
  engine: AudioEngine | null,
  _id: string,
  config: UseGeneratedToneConfig = {}
): UseGeneratedToneResult {
  const [isReady, setIsReady] = useState(false);
  const [state, setState] = useState<SoundState>('stopped');

  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const pannerRef = useRef<PannerNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const configRef = useRef(config);
  const stopTimeoutRef = useRef<number | null>(null);
  const targetVolumeRef = useRef(config.volume ?? 0.5);

  useEffect(() => {
    if (!engine || !engine.isReady) return;

    const context = engine.getContext();

    // Generate tone buffer
    bufferRef.current = generateToneBuffer(context, configRef.current.tone);

    // Create nodes
    gainRef.current = context.createGain();
    gainRef.current.gain.value = configRef.current.volume ?? 0.5;

    pannerRef.current = context.createPanner();
    pannerRef.current.panningModel = 'HRTF';
    pannerRef.current.distanceModel = 'inverse';
    pannerRef.current.refDistance = configRef.current.spatial?.refDistance ?? 1;
    pannerRef.current.maxDistance = configRef.current.spatial?.maxDistance ?? 10000;
    pannerRef.current.rolloffFactor = configRef.current.spatial?.rolloffFactor ?? 1;

    if (configRef.current.spatial?.position) {
      const { x, y, z } = configRef.current.spatial.position;
      if (pannerRef.current.positionX !== undefined) {
        pannerRef.current.positionX.value = x;
        pannerRef.current.positionY.value = y;
        pannerRef.current.positionZ.value = z;
      }
    }

    // Connect: gain -> panner -> destination (via engine master gain)
    gainRef.current.connect(pannerRef.current);
    // Connect to context destination for now (ideally through master gain)
    pannerRef.current.connect(context.destination);

    setIsReady(true);

    return () => {
      // Clear any pending stop timeout
      if (stopTimeoutRef.current !== null) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }

      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {
          // Ignore
        }
        sourceRef.current.disconnect();
      }
      gainRef.current?.disconnect();
      pannerRef.current?.disconnect();
    };
  }, [engine, engine?.isReady]);

  const play = useCallback(() => {
    if (!engine?.isReady || !bufferRef.current || !gainRef.current) return;

    const context = engine.getContext();
    const now = context.currentTime;

    // Cancel any pending fade-out stop
    if (stopTimeoutRef.current !== null) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    // Stop existing source immediately
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // Ignore
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // Restore gain to target volume (may have been faded out)
    gainRef.current.gain.cancelScheduledValues(now);
    gainRef.current.gain.setValueAtTime(targetVolumeRef.current, now);

    // Create new source
    sourceRef.current = context.createBufferSource();
    sourceRef.current.buffer = bufferRef.current;
    sourceRef.current.loop = configRef.current.loop ?? false;
    sourceRef.current.connect(gainRef.current);

    sourceRef.current.onended = () => {
      setState('stopped');
    };

    sourceRef.current.start();
    setState('playing');
  }, [engine]);

  const stop = useCallback(() => {
    if (!sourceRef.current || !gainRef.current || !engine?.isReady) {
      setState('stopped');
      return;
    }

    const context = engine.getContext();
    const now = context.currentTime;

    // Cancel any existing automation and fade to zero
    gainRef.current.gain.cancelScheduledValues(now);
    gainRef.current.gain.setValueAtTime(gainRef.current.gain.value, now);
    gainRef.current.gain.linearRampToValueAtTime(0, now + CLICK_FREE_FADE_DURATION);

    // Schedule the actual stop after fade completes
    setState('stopped');
    stopTimeoutRef.current = window.setTimeout(() => {
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {
          // Ignore
        }
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      stopTimeoutRef.current = null;
    }, CLICK_FREE_FADE_DURATION * 1000 + 10);
  }, [engine]);

  const setPosition = useCallback((x: number, y: number, z: number) => {
    if (pannerRef.current) {
      if (pannerRef.current.positionX !== undefined) {
        pannerRef.current.positionX.value = x;
        pannerRef.current.positionY.value = y;
        pannerRef.current.positionZ.value = z;
      }
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    targetVolumeRef.current = clampedVolume;
    if (gainRef.current) {
      gainRef.current.gain.value = clampedVolume;
    }
  }, []);

  return {
    play,
    stop,
    setPosition,
    setVolume,
    isReady,
    isPlaying: state === 'playing',
    state,
  };
}
