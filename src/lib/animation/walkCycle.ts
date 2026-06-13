import type { WalkSettings } from '../registry/types';

/**
 * Reusable walk-cycle sampler.
 *
 * Conventions (character built facing -Z, back to the camera):
 * - hip/shoulder/elbow values are radians; positive = limb swings forward (-Z).
 * - knee values are radians of flexion (applied as negative rotation.x on the knee joint).
 * - ankle values are radians; negative = toes down.
 * - bob/sway are world-unit offsets for the body root.
 * - plantL/plantR are 0..1 pulses peaking at each foot strike (drives step glow).
 */
export const defaultWalkSettings: WalkSettings = {
  strideHz: 1.25,
  legSwing: 0.55,
  kneeBend: 0.85,
  armSwing: 0.5,
  elbowBend: 0.45,
  bobAmount: 0.06,
  swayAmount: 0.04,
  pelvisRoll: 0.07,
  pelvisYaw: 0.12,
  torsoLean: 0.07,
  windStrength: 1
};

export type WalkPose = {
  phase: number;
  hipL: number;
  hipR: number;
  kneeL: number;
  kneeR: number;
  ankleL: number;
  ankleR: number;
  shoulderL: number;
  shoulderR: number;
  elbowL: number;
  elbowR: number;
  pelvisYaw: number;
  pelvisRoll: number;
  spineYaw: number;
  spineRoll: number;
  spineLean: number;
  headYaw: number;
  headRoll: number;
  headNod: number;
  bob: number;
  sway: number;
  plantL: number;
  plantR: number;
};

export function createWalkPose(): WalkPose {
  return {
    phase: 0,
    hipL: 0,
    hipR: 0,
    kneeL: 0,
    kneeR: 0,
    ankleL: 0,
    ankleR: 0,
    shoulderL: 0,
    shoulderR: 0,
    elbowL: 0,
    elbowR: 0,
    pelvisYaw: 0,
    pelvisRoll: 0,
    spineYaw: 0,
    spineRoll: 0,
    spineLean: 0,
    headYaw: 0,
    headRoll: 0,
    headNod: 0,
    bob: 0,
    sway: 0,
    plantL: 0,
    plantR: 0
  };
}

const { sin, cos, max, pow, PI } = Math;

/** Samples the pose at a given time into a preallocated WalkPose (no per-frame allocations). */
export function sampleWalkPose(time: number, s: WalkSettings, out: WalkPose): WalkPose {
  const p = time * s.strideHz * PI * 2;
  const pL = p;
  const pR = p + PI;
  out.phase = p;

  // Legs. Hip peaks forward at sin = 1; the swing phase is centered where cos = 1,
  // which is when the knee flexes hardest. Stance (cos < 0) keeps the leg straight.
  out.hipL = s.legSwing * sin(pL);
  out.hipR = s.legSwing * sin(pR);
  out.kneeL = 0.1 + s.kneeBend * pow(max(0, cos(pL)), 1.4);
  out.kneeR = 0.1 + s.kneeBend * pow(max(0, cos(pR)), 1.4);
  out.ankleL = -(0.3 * max(0, cos(pL - 0.4)) + 0.22 * max(0, -sin(pL - 0.3)));
  out.ankleR = -(0.3 * max(0, cos(pR - 0.4)) + 0.22 * max(0, -sin(pR - 0.3)));

  // Foot-strike pulses, sharpened so the glow pops on contact and fades between steps.
  out.plantL = pow(max(0, sin(pL)), 3);
  out.plantR = pow(max(0, sin(pR)), 3);

  // Arms swing opposite their same-side leg, with a relaxed elbow that
  // bends a little more on the forward swing.
  out.shoulderL = s.armSwing * sin(pL + PI);
  out.shoulderR = s.armSwing * sin(pR + PI);
  out.elbowL = 0.3 + s.elbowBend * max(0, sin(pL + PI));
  out.elbowR = 0.3 + s.elbowBend * max(0, sin(pR + PI));

  // Body: two bobs per stride (highest mid-single-stance), lateral weight shift
  // toward the planted leg, pelvis yaw/roll countered up the spine to the head.
  out.bob = s.bobAmount * (0.5 + 0.5 * cos(2 * p));
  out.sway = s.swayAmount * cos(p);
  out.pelvisYaw = -s.pelvisYaw * sin(p);
  out.pelvisRoll = s.pelvisRoll * cos(p);
  out.spineYaw = -out.pelvisYaw * 0.6;
  out.spineRoll = -out.pelvisRoll * 0.5;
  out.spineLean = -(s.torsoLean + 0.25 * s.torsoLean * cos(2 * p));
  out.headYaw = out.pelvisYaw * 0.25;
  out.headRoll = -out.spineRoll * 0.6;
  out.headNod = 0.04 * cos(2 * p + 0.7);

  return out;
}
