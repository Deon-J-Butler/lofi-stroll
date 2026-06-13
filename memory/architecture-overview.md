---
name: architecture-overview
description: How lofi-stroll wires scenes, characters, the rolling-planet stage, and the swap registry
metadata:
  type: project
---

Lofi-stroll is a Svelte 5 + TS + Vite + Three.js "strolling studio". Scenes and characters are fully swappable through a registry and must stay decoupled.

- **Registry** (`src/lib/registry/`): `types.ts` (CharacterDefinition, WalkSettings, SceneDefinition, StudioPreset, ControllerKind, SceneKind), `characters.ts`, `scenes.ts`, `presets.ts`. `App.svelte` builds its two dropdowns directly from `characters` + `scenes` (presets are metadata only, not wired to UI).
- **Characters** (`src/lib/characters/`): all procedural (no GLB pipeline — the old `glb-walker`/fox-chibi was removed). Each builder returns a `CharacterController = { group, update(qt, frameIdx), setGradient?, destroy() }`. `index.ts` maps `ControllerKind -> factory` (a `Record`, so every kind must have a factory). Kinds: `retro-kid` (reference custom-rigged walker; carries its own floating music notes so they follow it into any scene) and `flying-hero` (forward-leaning flight pose, pink suit + cape, flight FX, neon RGB strobe via `setGradient`).
- **Cross-cutting character knobs** (all optional on `CharacterDefinition`, honored by scenes): `clearance` (keep-clear flight corridor — scenes call `clearLateralDistance()` in planetStage to push props out; jungle uses it for trees); `speedScale` (multiplies the scene's `walkSpeed`); scenes forward their RGB toggle via `character.setGradient?.(on)` from each scene's `setGradient`.
- **Stage** (`src/lib/scenes/common/planetStage.ts`): the character sits fixed at the apex (world origin, y≈0) while a big sphere rolls underneath, sweeping props past. `onPlanet(obj, a, b, h)` places props: a = angle along path, b = lateral tilt (radians; world dist = b*R), h = radial lift. `lateral(d) = d/R`. jungle + metropolis use this; trippy-90s has its own inlined copy.
- **Stop-motion clock**: scenes call `character.update(frameIdx/30, frameIdx)` at 30fps; `rnd(i, salt)` (from `makeRng`) gives deterministic per-frame jitter shared with the world's ink-outline "boil".
- Convention: characters are built facing **-Z** (back to camera, moving away down the road); `rotationY` adjusts yaw. Scene files carry `// @ts-nocheck`; character/registry files are type-checked.
- README roadmap explicitly lists a "superhero flying scene" as planned direction.
