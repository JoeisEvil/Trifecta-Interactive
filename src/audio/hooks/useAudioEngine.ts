/**
 * Sonance Audio Engine - useAudioEngine Hook
 * Manages AudioEngine lifecycle in React
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioEngine } from '../core/AudioEngine';
import type { AudioEngineConfig, AudioEngineState } from '../core/types';

export interface UseAudioEngineResult {
  engine: AudioEngine | null;
  state: AudioEngineState;
  isReady: boolean;
  resume: () => Promise<void>;
}

export function useAudioEngine(config?: AudioEngineConfig): UseAudioEngineResult {
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [state, setState] = useState<AudioEngineState>('suspended');
  const engineRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    const audioEngine = new AudioEngine(config);
    engineRef.current = audioEngine;

    audioEngine.init().then(() => {
      setEngine(audioEngine);
      setState(audioEngine.state);

      // Poll for state changes (context.onstatechange doesn't always fire)
      const interval = setInterval(() => {
        if (engineRef.current) {
          const currentState = engineRef.current.state;
          setState((prev) => (prev !== currentState ? currentState : prev));
        }
      }, 100);

      return () => clearInterval(interval);
    });

    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const resume = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.resume();
      setState(engineRef.current.state);
    }
  }, []);

  return {
    engine,
    state,
    isReady: state === 'running',
    resume,
  };
}
