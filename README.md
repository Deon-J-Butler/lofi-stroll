# Lo-Fi Strolling Studio

**Lo-Fi Strolling Studio** is an experimental Three.js creative-coding project for building animated lo-fi walking scenes with swappable characters, scenes, and visual presets.

The current prototype features three fully realized worlds — a trippy 90s city road, a dense jungle trail, and a Megamind-style metropolis avenue — each playable in day or night mode. The default character is a custom 90s chibi walker in a black lo-fi hoodie (hood up), full-length jeans, chunky black sneakers, a backward cap, and over-ear headphones, with floating music notes drifting off them.

This is not the final art direction yet. The project is being shaped into a reusable "strolling studio" where scenes and characters can be swapped without rewriting the render loop.

## Current status

The project has moved from a single HTML experiment into a **Svelte + TypeScript + Vite + Three.js** app.

Three scenes are complete and stable:

- **Trippy 90s City Road** — curved planet road, warped neon buildings, striped sun, music notes, line-boil animation
- **Jungle Trail** — dirt path through oversized trees, orange/yellow/red day palette, deep blue/purple night with stars and glowing eyes
- **MetroCity Avenue** — art-deco towers, Space-Needle saucer, Statue of Liberty, lit windows at night

Two characters are registered and ready:

- **90s Retro Kid** — the default lo-fi walker (hoodie, jeans, sneakers, floating music notes)
- **Flying Hero** — procedural superhero in a forward-leaning flight pose (pink suit, starred cape, speed lines, power aura)

Long-term direction:

- 90s lo-fi walking scenes
- Superhero flying scenes
- Adventure/cartoon-inspired goof-off scenes
- Custom stylized characters with reusable movement controllers

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build
npm run preview    # preview production build
npm run test       # unit tests (Vitest)
npx tsc --noEmit   # type check
```

Controls:

- `F` fullscreen
- `H` hide/show the studio panel

## 2D illustrated mode

The `2D` studio toggle switches to a layered canvas renderer:

- A procedurally drawn character (8 poses, 8 FPS) with floating music notes
- 8 painted background WebP keyframes per scene per lighting variant, looped over ~56 seconds
- Day/night variants for all three scenes (`trippy-90s`, `trippy-90s-night`, `jungle`, `jungle-night`, `metropolis`, `metropolis-night`)
- Animated canvas overlays for clouds, fireflies, dappled light, and smog
- A gentle forward push (Ken Burns) during each held background frame
- On-demand scene preloading so scene switches do not expose blank frames
- 2D mode locks the character to 90s Retro Kid and disables RGB

Timing values in `src/lib/illustrated/stopMotion.ts`:

- `createStopMotionClock(fps)` — controls character animation rate
- Background cycle length and transition timing are set in each scene layer

Run `npm run dev`, select `2D`, and switch among the three scenes to verify the walk cycle and environment motion. Use `npm run test` for overlay/animation tests.

## GitHub Pages

This is a Vite app, so GitHub Pages should serve the built `dist/` output, not the raw `src/` files.

The current `vite.config.ts` uses:

```ts
base: '/lofi-stroll'
```

If the GitHub repo name changes, update `base` to match the repo path.

Recommended deployment path:

1. Commit the project source.
2. Add a GitHub Pages workflow under `.github/workflows/`.
3. Build with `npm run build`.
4. Deploy the generated `dist/` folder.

Do **not** add `.github/` to `.gitignore`; deployment workflows should be committed.

## Architecture

```txt
src/lib/
  registry/      scene, character, and preset metadata
    types.ts       CharacterDefinition, WalkSettings, StepGlowSettings, SceneDefinition, StudioPreset
    characters.ts  registered characters: retro-kid, flying-hero
    scenes.ts      registered scenes: trippy-90s, jungle, metropolis
    presets.ts     scene + character combinations

  scenes/        world builders
    createTrippy90sScene.ts
    createJungleScene.ts
    createMetropolisScene.ts
    common/
      planetStage.ts      shared curved-planet road surface + prop scatter
      cameraRig.ts        shared camera + dolly setup

  characters/    character controllers
    controller.ts            shared CharacterController contract
    index.ts                 controller factory
    createRetroKidWalker.ts  custom procedural 90s chibi walker
    createFlyingHero.ts      procedural flying superhero (pink suit, cape, flight FX)
    common/stepGlowRig.ts    shared step glow, contact shadow, and rim light

  animation/     reusable animation math
    walkCycle.ts             WalkSettings -> WalkPose sampler

  debug/         model and orientation helpers
    orientationGizmo.ts      axes + FRONT/BACK markers

  illustrated/   2D canvas renderer
    stopMotion.ts            stop-motion clock (fps → discrete frame index)
    sketch.ts                rough-fill and hatch-shadow canvas helpers
    store.ts                 Svelte store toggling illustrated mode
    layers/
      character2D.ts         procedural chibi walker (8 poses, canvas)
      road.ts                road surface overlay
      buildingCorridor.ts    shared building strip renderer
      scenes/
        trippy90s2D.ts       Trippy 90s 2D scene layer
        metropolis2D.ts      MetroCity 2D scene layer
    assets/
      character/             walk cycle image references (v1, walk-v2, walk-v3)
      background-frames/     8 WebP keyframes × 6 lighting variants

  components/    Svelte shell components
    ThreeStage.svelte        mounts/destroys the Three.js experience
```

The scene stays character-agnostic. It calls:

```ts
createCharacter(definition, rnd)
```

and only works against the controller contract:

```ts
{
  group: THREE.Group;
  update(qt: number, frameIdx: number): void;
  destroy(): void;
}
```

That keeps scenes, characters, animation behavior, and registry metadata separated.

## Characters

### 90s Retro Kid

Default character:

```ts
controller: 'retro-kid'
```

Fully procedural, jointed character built from Three.js primitives so the walk cycle drives real pivots instead of only bobbing a static mesh.

Design goals:

- chibi proportions — stout build, short thick legs, big head
- brown skin
- black lo-fi hoodie with hood up
- backward snapback cap visible under the hood
- over-ear headphones
- full-length dark-wash jeans
- chunky black sneakers with cream midsole and red accent
- floating music notes drifting off the character into every scene
- readable back-facing silhouette
- relaxed lo-fi walk cycle
- glowing footstep rhythm

The character is built facing **-Z** so `rotationY: 0` means their back faces the camera and they walk away down the road.

Current joint hierarchy:

```txt
group
  body
    pelvis
      left/right hips
        knees
          ankles
            sneakers
      spine
        shoulders
          elbows
            hands
        neck
          head
            cap (backward)
            headphones
            afro fringe
        hoodie back panel (cloth)
```

### Flying Hero (MetroCity / Jungle)

Procedural flying superhero, swappable across all scenes:

```ts
controller: 'flying-hero'
```

Instead of a walk cycle it holds a forward-leaning flight pose and runs a *flight idle*.

Design goals:

- a Black woman with voluminous curly hair (swept back, fluttering in the flight wind)
- pink colorway costume (magenta suit, deep-plum boots/gloves, light-pink trim, gold belt)
- a billowing cape with a star emblem
- classic flight silhouette: fist leading, legs streamed back together, head lifted
- flight FX: rushing speed lines, a soft pink power aura + rim light, hover bob, and a
  faint drifting ground shadow far below to sell the altitude

It reuses a few `walk` fields for tuning: `strideHz` → hover frequency, `bobAmount` →
hover bob height, `windStrength` → cape/hair billow. It uses no step-glow rig (no feet
on the ground), and it declares a **clearance** corridor (see below).

Joint hierarchy:

```txt
group
  flight                (hover bob + bank + speed lines + aura)
    body                (yaw + scale + forward flight pitch)
      pelvis
        left/right hips → knees → ankles → pointed boots (trailing)
        spine
          shoulders → elbows → fists (one leading, one trailing)
          neck → head → curly hair
          cape pivot → billowing starred cape
```

### Clearance — keeping elevated characters collision-free

Characters are placed at the apex of the rolling planet, so every prop eventually
sweeps over them. A grounded walker is short and narrow and the existing prop layouts
already miss it — but an elevated/airborne character occupies space up where tree
canopies, vines, and branches live. To keep designs swappable *and* collision-free, a
character can declare a keep-clear cylinder:

```ts
clearance: { radius: 2.6, baseY: 1.6, topY: 6.6 } // world units
```

Scenes that scatter props near the path consult `clearLateralDistance()`
(`scenes/common/planetStage.ts`) and push any prop whose footprint would intrude the
column outward — carving a clear flight corridor. The jungle does this for its trees
(tall trees only pass their thin trunk through the band, so their wide canopy is left
overhanging overhead; short trees are cleared fully). Characters that omit `clearance`
(the walkers) are completely unaffected.

## Art direction

The target style is still evolving, but the current direction is:

- lo-fi 90s nostalgia
- hand-painted anime atmosphere
- rubbery cartoon geometry
- bold ink outlines
- warped perspective
- warm sunset/neon colors
- dreamy music-video energy
- readable chibi silhouettes

A useful shorthand:

> 80s/90s anime mood and lighting, mixed with loopy 90s cartoon shapes and a browser-friendly Three.js build.

The world can stay surreal and warped, but the character needs to be clean, readable, and intentionally designed.

## Scenes

### Trippy 90s City Road

```ts
id: 'trippy-90s'
```

- curved road on a planet-like surface
- melted/wobbly city buildings
- neon sidewalks and street markings
- striped sun
- floating music notes
- line-boil animation
- stop-motion character rhythm
- glowing footstep lights

### Jungle Trail

```ts
id: 'jungle'
```

- dirt path through oversized jungle trees and frayed grass
- day palette: orange/yellow/red
- night palette: deep blue/purple with stars, celestial bursts, and slowly flashing red eyes in the undergrowth
- sun/moon toggle
- tree props respect the flying hero's clearance corridor

### MetroCity Avenue

```ts
id: 'metropolis'
```

- bright Megamind-style metropolis with imposing towers and art-deco setbacks
- Space-Needle saucer tower
- Statue of Liberty silhouette
- fluffy clouds and a yellow sun
- every window lights up at night (sun/moon toggle)
- designed for both the grounded walker and the flying hero

Future scenes should live in `src/lib/scenes/` and be registered in `src/lib/registry/scenes.ts`.

## Presets

Five scene + character combinations are registered in `src/lib/registry/presets.ts`:

| Preset | Scene | Character |
| --- | --- | --- |
| Trippy 90s + Retro Kid | trippy-90s | retro-kid |
| Jungle Trail + Retro Kid | jungle | retro-kid |
| MetroCity Avenue + Retro Kid | metropolis | retro-kid |
| MetroCity Avenue + Flying Hero | metropolis | flying-hero |
| Jungle Trail + Flying Hero | jungle | flying-hero |

## Adding or tuning a character

Characters are fully procedural — built from jointed Three.js primitives, no GLB
pipeline. To add one:

1. Implement a builder in `src/lib/characters/` that returns a `CharacterController`
   (`{ group, update(qt, frameIdx), setGradient?, destroy() }`). Build it facing **-Z**.
2. Add its controller kind to `ControllerKind` in `src/lib/registry/types.ts` and
   register the builder in `src/lib/characters/index.ts`.
3. Register the character in `src/lib/registry/characters.ts`:

```ts
{
  id: 'my-character',
  label: 'My Character',
  controller: 'my-controller',
  rotationY: 0,
  scale: 1,
  position: { x: 0, y: 0, z: 0 },
  walk: {
    strideHz: 1.25,
    legSwing: 0.55,
    windStrength: 1
  },
  stepGlow: { enabled: true, size: 0.62, intensity: 0.5, rimLight: true },
  // optional: elevated/airborne characters declare a keep-clear flight corridor
  // clearance: { radius: 2.6, baseY: 1.6, topY: 6.6 },
  // optional: a multiplier on the scene's stroll speed (a flyer moves a bit faster)
  // speedScale: 1.3,
  debug: false,
  status: 'ready'
}
```

Reuse `sampleWalkPose` (`animation/walkCycle.ts`) for gait math and
`createStepGlowRig` for ground glow where it fits.

## Orientation debugging

Set this on a character registry entry:

```ts
debug: true
```

The orientation gizmo should show:

- `FRONT` pointing down the road toward the sun/horizon
- `BACK` pointing toward the camera/viewer

Tune `rotationY`, `scale`, and `position` in the character registry until the character is centered, grounded, and walking away from the viewer.

## Walk tuning cheat sheet

| Setting | Effect |
| --- | --- |
| `strideHz` | stride speed; `1.1`–`1.4` reads relaxed and lo-fi |
| `legSwing` | hip swing/stride size |
| `kneeBend` | swing-phase knee lift |
| `armSwing` | arm counter-swing |
| `elbowBend` | elbow flex during arm swing |
| `bobAmount` | vertical bounce |
| `swayAmount` | lateral weight shift |
| `pelvisYaw` | hip twist |
| `pelvisRoll` | hip drop from side to side |
| `torsoLean` | forward body lean |
| `windStrength` | hoodie/cloth billow strength |

## Performance notes

Current performance approach:

- one Three.js render loop owned by the active scene
- character updates are held to the scene's stop-motion clock
- geometries and materials are created once where practical
- animation mutates pivots and small cloth buffers instead of rebuilding meshes
- step glow uses lightweight planes/contact shadow/rim lighting
- debug helpers can be disabled through registry config

Avoid:

- huge unoptimized GLBs
- per-frame scene rebuilds
- unnecessary per-frame allocations
- large textures unless needed
- heavy shadows/lights without a clear visual payoff

## Roadmap

Near-term:

- refine the 90s Retro Kid proportions and silhouette
- improve the hoodie cloth/wind motion
- tune walk cycle readability from behind
- polish character colors and outlines to better match the scene
- add a character preset editor panel
- add scene presets and camera presets
- add export/share settings
- add GitHub Pages deployment workflow

Future:

- Adventure Time-inspired walking scene
- additional 90s lo-fi worlds
- importable custom character packs

## Git hygiene

Recommended ignored files are in `.gitignore`.

Important notes:

- Commit `.github/` if you add GitHub Actions workflows.
- Ignore `.claude/` because it is usually local assistant/session configuration.
- Keep source, registry files, public assets, and intentional design references committed.
- Do not commit `node_modules/`, `dist/`, TypeScript build info, logs, or local environment files.
