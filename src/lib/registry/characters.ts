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
      size: 0.62,
      intensity: 0.5,
      rimLight: true
    },
    debug: false,
    status: 'ready',
    notes:
      'Custom rigged chibi: backward snapback, over-ear headphones, oversized open jersey blowing in the wind, jean shorts, True Blue-style sneakers. Real walk cycle with step glow synced to the feet.'
  },
  {
    id: 'fox-chibi',
    label: 'Fox Chibi (GLB reference)',
    controller: 'glb-walker',
    modelUrl:
      '/assets/characters/fox-chibi/source/a_chibi_style_image_of_a_female_character_with_fox_ears_and_a_ta.glb',
    rotationY: Math.PI,
    scale: 3.05,
    debug: false,
    status: 'reference',
    notes:
      'Uploaded AI-generated GLB. Inspected with scripts/inspect-glb.mjs: single static mesh, no skeleton, no animations — kept only as a scale/silhouette reference.'
  }
];
