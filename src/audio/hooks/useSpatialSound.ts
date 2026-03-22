/**
 * Sonance Audio Engine - useSpatialSound Hook
 * Manages a single spatial sound instance
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AudioEngine } from '../core/AudioEngine';
import type { Sound } from '../spatial/Sound';
import type { SoundConfig, SoundState } from '../core/types';

export interface UseSpatialSoundResult {
  sound: Sound | null;
  play: () => void;
  stop: () => void;
  setPosition: (x: number, y: number, z: number) => void;
  setVolume: (volume: number) => void;
  fadeTo: (volume: number, duration?: number) => void;
  isLoaded: boolean;
  isPlaying: boolean;
  state: SoundState;
}

export function useSpatialSound(
  engine: AudioEngine | null,
  id: string,
  config: SoundConfig
): UseSpatialSoundResult {
  const [sound, setSound] = useState<Sound | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [state, setState] = useState<SoundState>('stopped');
  const soundRef = useRef<Sound | null>(null);
  const configRef = useRef(config);

  useEffect(() => {
    if (!engine) return;

    const newSound = engine.createSound(id, configRef.current);
    soundRef.current = newSound;

    newSound.onLoaded = () => {
      setIsLoaded(true);
    };

    newSound.onEnded = () => {
      setState('stopped');
    };

    newSound.load().then(() => {
      setSound(newSound);
      setIsLoaded(true);
    }).catch((error) => {
      console.error(`Failed to load sound "${id}":`, error);
    });

    return () => {
      engine.removeSound(id);
      soundRef.current = null;
    };
  }, [engine, id]);

  const play = useCallback(() => {
    if (soundRef.current?.isLoaded) {
      soundRef.current.play();
      setState('playing');
    }
  }, []);

  const stop = useCallback(() => {
    if (soundRef.current) {
      soundRef.current.stop();
      setState('stopped');
    }
  }, []);

  const setPosition = useCallback((x: number, y: number, z: number) => {
    soundRef.current?.setPosition(x, y, z);
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (soundRef.current) {
      soundRef.current.volume = volume;
    }
  }, []);

  const fadeTo = useCallback((volume: number, duration?: number) => {
    soundRef.current?.fadeTo(volume, duration);
  }, []);

  return {
    sound,
    play,
    stop,
    setPosition,
    setVolume,
    fadeTo,
    isLoaded,
    isPlaying: state === 'playing',
    state,
  };
}
