export type SceneKind = 'trippy-90s' | 'jungle' | 'metropolis';

/** Which runtime controller builds/drives the character. */
export type ControllerKind = 'retro-kid' | 'flying-hero';

export type WalkSettings = {
  /** Strides per second (one full left+right cycle). */
  strideHz: number;
  /** Hip swing amplitude in radians. */
  legSwing: number;
  /** Peak knee flexion in radians during the swing phase. */
  kneeBend: number;
  /** Shoulder swing amplitude in radians. */
  armSwing: number;
  /** Extra elbow flexion in radians as the arm swings forward. */
  elbowBend: number;
  /** Vertical bob in world units (two bobs per stride). */
  bobAmount: number;
  /** Lateral weight-shift in world units. */
  swayAmount: number;
  /** Pelvis roll amplitude in radians. */
  pelvisRoll: number;
  /** Pelvis yaw amplitude in radians (counter-rotated by the spine). */
  pelvisYaw: number;
  /** Constant forward lean of the torso in radians. */
  torsoLean: number;
  /** Multiplier for cloth/jersey wind motion. */
  windStrength: number;
};

export type StepGlowSettings = {
  enabled: boolean;
  /** Glow plane size in world units. */
  size: number;
  /** Peak glow opacity (0..1). */
  intensity: number;
  /** Whether the cyan rim point light is attached. */
  rimLight: boolean;
};

/**
 * A keep-clear cylinder around the lane apex so scene props never intersect an
 * elevated / airborne character (e.g. a flyer). Centered on the lane center, it
 * runs from `baseY` up to `topY` with the given `radius` — all in world units.
 * Scenes that scatter props near the path push them outward so the character
 * always has a clear corridor. Grounded walkers simply omit this.
 */
export type ClearanceVolume = {
  /** Cylinder radius in world units (lateral keep-clear distance from lane center). */
  radius: number;
  /** Top of the band; props whose footprint reaches above `baseY` and below this get cleared. */
  topY: number;
  /** Bottom of the band. Defaults to 0 (the ground). */
  baseY?: number;
};

export type CharacterDefinition = {
  id: string;
  label: string;
  controller: ControllerKind;
  /** Yaw in radians. 0 = back to the camera, walking away down the road. */
  rotationY?: number;
  scale?: number;
  /** World-space offset from the lane center at the top of the planet. */
  position?: { x: number; y: number; z: number };
  walk?: Partial<WalkSettings>;
  stepGlow?: Partial<StepGlowSettings>;
  /** Keep-clear volume for elevated/airborne characters so props never clip through them. */
  clearance?: ClearanceVolume;
  /** Multiplies the scene's forward stroll speed (e.g. a flyer moves a bit faster). Default 1. */
  speedScale?: number;
  /** Shows axes + FRONT/BACK markers at the character origin. */
  debug?: boolean;
  status: 'ready' | 'reference' | 'stub';
  notes?: string;
};

export type SceneDefinition = {
  id: SceneKind;
  label: string;
  description: string;
  status: 'ready' | 'stub';
};

export type StudioPreset = {
  id: string;
  label: string;
  sceneId: SceneKind;
  characterId: string;
};
