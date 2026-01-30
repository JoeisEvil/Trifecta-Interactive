/**
 * Sonance Audio Engine - Type Definitions
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type AudioEngineState = 'suspended' | 'running' | 'closed';
export type SoundState = 'stopped' | 'playing' | 'paused';

export interface SpatialConfig {
  position?: Vector3;
  panningModel?: PanningModelType;
  distanceModel?: DistanceModelType;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  coneInnerAngle?: number;
  coneOuterAngle?: number;
  coneOuterGain?: number;
}

export interface SoundConfig {
  url: string;
  volume?: number;
  loop?: boolean;
  autoplay?: boolean;
  offset?: number;           // Start offset in seconds
  crossfadeDuration?: number; // Crossfade duration for seamless looping (seconds)
  spatial?: SpatialConfig;
}

export interface ListenerConfig {
  position?: Vector3;
  forward?: Vector3;
  up?: Vector3;
}

export interface AudioEngineConfig {
  autoResume?: boolean;
  masterVolume?: number;
  reverbWet?: number;      // Reverb wet level 0-1 (default: 0.15)
  reverbDry?: number;      // Reverb dry level 0-1 (default: 1)
}

export interface SoundEvents {
  onEnded?: () => void;
  onLoaded?: () => void;
  onError?: (error: Error) => void;
}
