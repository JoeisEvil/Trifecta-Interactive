/**
 * AudioProvider - React context for Sonance Audio Engine
 */

import { createContext, useContext, ReactNode } from 'react';
import { useAudioEngine, UseAudioEngineResult } from './audio';

const AudioContext = createContext<UseAudioEngineResult | null>(null);

interface AudioProviderProps {
  children: ReactNode;
}

export function AudioProvider({ children }: AudioProviderProps) {
  const audioEngine = useAudioEngine();

  return (
    <AudioContext.Provider value={audioEngine}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio(): UseAudioEngineResult {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
