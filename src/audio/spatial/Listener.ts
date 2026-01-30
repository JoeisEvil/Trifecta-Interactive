/**
 * Sonance Audio Engine - Listener (Ear Position)
 * Syncs with Three.js Camera for spatial audio positioning
 */

import type { ListenerConfig, Vector3 } from '../core/types';
import { DEFAULT_LISTENER_CONFIG } from '../core/constants';
import type { Camera } from 'three';

export class Listener {
  private audioListener: AudioListener;
  private position: Vector3;
  private forward: Vector3;
  private up: Vector3;

  constructor(context: AudioContext, config?: ListenerConfig) {
    this.audioListener = context.listener;

    const mergedConfig = { ...DEFAULT_LISTENER_CONFIG, ...config };
    this.position = { ...mergedConfig.position };
    this.forward = { ...mergedConfig.forward };
    this.up = { ...mergedConfig.up };

    this.applyPosition();
    this.applyOrientation();
  }

  /**
   * Set the listener position in 3D space
   */
  setPosition(x: number, y: number, z: number): void {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
    this.applyPosition();
  }

  /**
   * Set the listener orientation
   * @param fx Forward X
   * @param fy Forward Y
   * @param fz Forward Z
   * @param ux Up X
   * @param uy Up Y
   * @param uz Up Z
   */
  setOrientation(
    fx: number,
    fy: number,
    fz: number,
    ux: number,
    uy: number,
    uz: number
  ): void {
    this.forward.x = fx;
    this.forward.y = fy;
    this.forward.z = fz;
    this.up.x = ux;
    this.up.y = uy;
    this.up.z = uz;
    this.applyOrientation();
  }

  /**
   * Sync listener position and orientation with a Three.js camera
   */
  syncWithCamera(camera: Camera): void {
    // Update camera world matrix to ensure we have latest values
    camera.updateMatrixWorld();

    // Extract position from world matrix
    const position = camera.position;
    this.position.x = position.x;
    this.position.y = position.y;
    this.position.z = position.z;

    // Extract forward direction (negative Z in camera space)
    const matrix = camera.matrixWorld.elements;
    // Forward is the negative of the third column (camera looks down -Z)
    this.forward.x = -matrix[8];
    this.forward.y = -matrix[9];
    this.forward.z = -matrix[10];

    // Up is the second column
    this.up.x = matrix[4];
    this.up.y = matrix[5];
    this.up.z = matrix[6];

    this.applyPosition();
    this.applyOrientation();
  }

  /**
   * Get current position
   */
  getPosition(): Vector3 {
    return { ...this.position };
  }

  /**
   * Get current forward direction
   */
  getForward(): Vector3 {
    return { ...this.forward };
  }

  /**
   * Get current up direction
   */
  getUp(): Vector3 {
    return { ...this.up };
  }

  private applyPosition(): void {
    const listener = this.audioListener;
    const { x, y, z } = this.position;

    if (listener.positionX !== undefined) {
      // Modern API
      listener.positionX.value = x;
      listener.positionY.value = y;
      listener.positionZ.value = z;
    } else {
      // Legacy API fallback
      (listener as any).setPosition(x, y, z);
    }
  }

  private applyOrientation(): void {
    const listener = this.audioListener;
    const { x: fx, y: fy, z: fz } = this.forward;
    const { x: ux, y: uy, z: uz } = this.up;

    if (listener.forwardX !== undefined) {
      // Modern API
      listener.forwardX.value = fx;
      listener.forwardY.value = fy;
      listener.forwardZ.value = fz;
      listener.upX.value = ux;
      listener.upY.value = uy;
      listener.upZ.value = uz;
    } else {
      // Legacy API fallback
      (listener as any).setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }
}
