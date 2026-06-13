import type { CharacterDefinition, ControllerKind } from '../registry/types';
import type { CharacterController, Rng } from './controller';
import { createRetroKidWalker } from './createRetroKidWalker';
import { createFlyingHero } from './createFlyingHero';

export type { CharacterController, Rng } from './controller';

type CharacterFactory = (character: CharacterDefinition, rnd: Rng) => CharacterController;

const factories: Record<ControllerKind, CharacterFactory> = {
  'retro-kid': createRetroKidWalker,
  'flying-hero': createFlyingHero
};

/** Builds the controller for a registry entry. Scenes stay character-agnostic. */
export function createCharacter(character: CharacterDefinition, rnd: Rng): CharacterController {
  const factory = factories[character.controller];
  if (!factory) throw new Error(`Unknown character controller: ${character.controller}`);
  return factory(character, rnd);
}
