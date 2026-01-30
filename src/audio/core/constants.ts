/**
 * Sonance Audio Engine - Default Constants
 */

import type { SpatialConfig, ListenerConfig, AudioEngineConfig } from './types';

export const DEFAULT_SPATIAL_CONFIG: Required<SpatialConfig> = {
  position: { x: 0, y: 0, z: 0 },
  panningModel: 'HRTF',
  distanceModel: 'inverse',
  refDistance: 1,
  maxDistance: 10000,
  rolloffFactor: 1,
  coneInnerAngle: 360,
  coneOuterAngle: 360,
  coneOuterGain: 0,
};

export const DEFAULT_LISTENER_CONFIG: Required<ListenerConfig> = {
  position: { x: 0, y: 0, z: 0 },
  forward: { x: 0, y: 0, z: -1 },
  up: { x: 0, y: 1, z: 0 },
};

export const DEFAULT_ENGINE_CONFIG: Required<AudioEngineConfig> = {
  autoResume: true,
  masterVolume: 1,
  reverbWet: 0.15,
  reverbDry: 1,
};

export const DEFAULT_VOLUME = 1;
export const DEFAULT_LOOP = false;
export const DEFAULT_FADE_DURATION = 0.1;
export const CLICK_FREE_FADE_DURATION = 0.03; // 30ms fade to prevent clicks
export const MIN_VOLUME = 0;
export const MAX_VOLUME = 1;
