import type * as THREE from 'three';

/** Deterministic per-frame jitter source shared with the scene's stop-motion clock. */
export type Rng = (i: number, salt: number) => number;

export type CharacterController = {
  /** Root added to the scene at the lane center. Stays at the world origin; the planet scrolls. */
  group: THREE.Group;
  /**
   * Advance the held stop-motion pose.
   * @param qt quantized time in seconds (frameIdx / CHAR_FPS)
   * @param frameIdx integer stop-motion frame index, for rng jitter
   */
  update: (qt: number, frameIdx: number) => void;
  /** Optional: scenes forward their RGB-gradient toggle here (e.g. the hero's RGB strobe). */
  setGradient?: (on: boolean) => void;
  destroy: () => void;
};
