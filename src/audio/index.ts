/**
 * Sonance Audio Engine
 * A 3D spatial audio library for Three.js and React
 */

// Core
export { AudioEngine } from './core/AudioEngine';
export type {
  Vector3,
  AudioEngineState,
  SoundState,
  SpatialConfig,
  SoundConfig,
  ListenerConfig,
  AudioEngineConfig,
  SoundEvents,
} from './core/types';
export {
  DEFAULT_SPATIAL_CONFIG,
  DEFAULT_LISTENER_CONFIG,
  DEFAULT_ENGINE_CONFIG,
  DEFAULT_VOLUME,
  DEFAULT_LOOP,
  DEFAULT_FADE_DURATION,
  CLICK_FREE_FADE_DURATION,
} from './core/constants';

// Spatial
export { Sound } from './spatial/Sound';
export { Listener } from './spatial/Listener';

// Hooks
export { useAudioEngine } from './hooks/useAudioEngine';
export type { UseAudioEngineResult } from './hooks/useAudioEngine';
export { useListener } from './hooks/useListener';
export { useSpatialSound } from './hooks/useSpatialSound';
export type { UseSpatialSoundResult } from './hooks/useSpatialSound';
export { useGeneratedTone } from './hooks/useGeneratedTone';
export type { UseGeneratedToneConfig, UseGeneratedToneResult } from './hooks/useGeneratedTone';

// Utils
export { loadAudioBuffer, isBufferCached, removeFromCache, clearCache } from './utils/audioLoader';
export { lerp, clamp, vectorDistance, normalizeVector, lerpVector3 } from './utils/mathUtils';
export { generateToneBuffer, bufferToDataUrl } from './utils/toneGenerator';
export type { ToneOptions } from './utils/toneGenerator';
export { generateReverbImpulse, generateHallReverb, generateRoomReverb } from './utils/reverbGenerator';
export type { ReverbConfig } from './utils/reverbGenerator';
