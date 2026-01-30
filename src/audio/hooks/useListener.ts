/**
 * Sonance Audio Engine - useListener Hook
 * Syncs AudioEngine listener with Three.js camera each frame
 */

import { useFrame, useThree } from '@react-three/fiber';
import type { AudioEngine } from '../core/AudioEngine';

export function useListener(engine: AudioEngine | null): void {
  const { camera } = useThree();

  useFrame(() => {
    if (engine && engine.isReady) {
      engine.updateListener(camera);
    }
  });
}
