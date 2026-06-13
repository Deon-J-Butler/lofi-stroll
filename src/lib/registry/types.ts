export type SceneKind = 'trippy-90s';

/** Which runtime controller builds/drives the character. */
export type ControllerKind = 'retro-kid' | 'glb-walker';

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

export type CharacterDefinition = {
  id: string;
  label: string;
  controller: ControllerKind;
  /** Only used by 'glb-walker' controllers. */
  modelUrl?: string;
  /** Yaw in radians. 0 = back to the camera, walking away down the road. */
  rotationY?: number;
  scale?: number;
  /** World-space offset from the lane center at the top of the planet. */
  position?: { x: number; y: number; z: number };
  walk?: Partial<WalkSettings>;
  stepGlow?: Partial<StepGlowSettings>;
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
