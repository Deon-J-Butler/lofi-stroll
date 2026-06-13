import type { SceneDefinition } from './types';

export const scenes: SceneDefinition[] = [
  {
    id: 'trippy-90s',
    label: 'Trippy 90s City Road',
    description: 'The current curved-road neon city world from v9. This is the baseline scenery and should not change during character passes.',
    status: 'ready'
  },
  {
    id: 'jungle',
    label: 'Jungle Trail',
    description: 'A dirt path through oversized jungle trees and frayed grass. Day burns orange/yellow/red; night goes deep blue and purple with stars, celestial bursts, and a few slowly flashing red eyes in the undergrowth. Toggle sun/moon.',
    status: 'ready'
  },
  {
    id: 'metropolis',
    label: 'MetroCity Avenue',
    description: 'A bright Megamind-style metropolis: imposing towers and art-deco setbacks, a Space-Needle saucer tower, the Statue of Liberty, fluffy clouds and a yellow sun. Toggle sun/moon to light up every window at night.',
    status: 'ready'
  }
];
