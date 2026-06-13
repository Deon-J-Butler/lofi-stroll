import type { CharacterDefinition } from './types';

export const characters: CharacterDefinition[] = [
  {
    id: 'retro-kid',
    label: '90s Retro Kid',
    controller: 'retro-kid',
    rotationY: 0, // built facing -Z: back to the camera, walking away
    scale: 1,
    position: { x: 0, y: 0, z: 0 },
    walk: {
      strideHz: 1.25,
      legSwing: 0.55,
      armSwing: 0.5,
      windStrength: 1
    },
    stepGlow: {
      enabled: true,
      size: 0.44,
      intensity: 0.52,
      rimLight: true
    },
    debug: false,
    status: 'ready',
    notes:
      'Custom rigged chibi in a black LO-FI hoodie (hood up), full-length jeans, and chunky black sneakers. Relaxed lo-fi walk cycle with glowing footsteps, and floating music notes that follow them into any scene.'
  },
  {
    id: 'flying-hero',
    label: 'Flying Hero',
    controller: 'flying-hero',
    rotationY: 0, // built facing -Z: back to the camera, flying away down the road
    scale: 1.12,
    position: { x: 0, y: 0, z: 0 },
    walk: {
      // flyer reuses a few walk fields: hover frequency, hover bob, cloth/hair wind
      strideHz: 0.5,
      bobAmount: 0.13,
      windStrength: 1.05
    },
    // keep-clear flight corridor so jungle canopy/vines never clip the airborne pose
    clearance: { radius: 2.6, baseY: 1.6, topY: 6.6 },
    // a flyer covers ground a little faster than a stroll
    speedScale: 1.3,
    debug: false,
    status: 'ready',
    notes:
      'Procedural flying superhero, swappable everywhere. A Black woman with voluminous curly hair in a pink colorway suit and starred cape, held in a forward-leaning flight pose — fist leading, legs streamed back, cape and hair billowing. Flight FX: speed lines, power aura, hover bob, drifting ground shadow, and RGB strobe when the RGB toggle is on. Declares a clearance corridor so props (e.g. jungle trees) never collide.'
  }
];
