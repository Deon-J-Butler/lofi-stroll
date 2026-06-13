// Scene dispatcher: picks the world builder for the active scene id.
// Every builder shares the same runtime contract:
//   create...Scene(container, { scene, character })
//     -> { renderer, scene, camera, setGradient?, setMoon?, destroy() }
import { createTrippy90sScene } from './createTrippy90sScene';
import { createJungleScene } from './createJungleScene';
import { createMetropolisScene } from './createMetropolisScene';
import type { CharacterDefinition, SceneDefinition } from '../registry/types';

export type SceneOptions = {
  scene: SceneDefinition;
  character: CharacterDefinition;
};

export function createScene(container: HTMLElement, options: SceneOptions) {
  switch (options.scene.id) {
    case 'jungle':
      return createJungleScene(container, options);
    case 'metropolis':
      return createMetropolisScene(container, options);
    case 'trippy-90s':
    default:
      return createTrippy90sScene(container, options);
  }
}
