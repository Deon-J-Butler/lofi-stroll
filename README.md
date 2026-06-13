# Lo-Fi Strolling Studio

**Lo-Fi Strolling Studio** is an experimental Three.js creative-coding project for building animated lo-fi walking scenes with swappable characters, scenes, and visual presets.

The current prototype is a trippy 90s-inspired city road: a curved planet-like street, warped neon buildings, a striped melting sun, music notes, line-boil motion, and glowing footstep lights. The first character pass is a custom 90s chibi walker wearing a backward cap, headphones, oversized open jersey, jean shorts, and retro basketball sneakers.

This is not the final art direction yet. The project is being shaped into a reusable “strolling studio” where future scenes can swap in different characters and worlds without rewriting the render loop.

## Current status

The project has moved from a single HTML experiment into a **Svelte + TypeScript + Vite + Three.js** app.

Current focus:

- Keep the original trippy 90s scenery stable.
- Build a clean character/scene registry system.
- Use a custom rigged/procedural 90s chibi as the default walker.
- Build fully procedural characters (no GLB pipeline) — e.g. the flying hero.
- Support future character and scenery swaps.

Long-term direction:

- 90s lo-fi walking scenes.
- Superhero flying scenes.
- Adventure/cartoon-inspired goof-off scenes.
- Custom stylized characters with reusable movement controllers.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build
npm run preview    # preview production build
npx tsc --noEmit   # type check
```

Controls:

- `F` fullscreen
- `H` hide/show the studio panel

## GitHub Pages

This is a Vite app, so GitHub Pages should serve the built `dist/` output, not the raw `src/` files.

The current `vite.config.ts` uses:

```ts
base: '/lofi-stroll'
```

If the GitHub repo name changes, update `base` to match the repo path. For example, if the repo is named `lofi-strolling`, use:

```ts
base: '/lofi-strolling/'
```

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
    characters.ts  registered characters: retro-kid default, flying-hero
    scenes.ts      registered scenes: trippy-90s
    presets.ts     scene + character combinations

  scenes/        world builders
    createTrippy90sScene.ts

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

  components/    Svelte shell components
    ThreeStage.svelte        mounts/destroys the Three.js experience

scripts/
  inspect-glb.mjs            CLI helper for checking GLB animations, skins, meshes, hierarchy, and bounds
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

This is the current custom/procedural character direction. It is built from jointed Three.js primitives so the walk cycle drives real pivots instead of only bobbing a static mesh.

Design goals:

- chibi proportions
- brown skin
- big backward snapback/trucker-style cap
- over-ear headphones
- oversized open jersey blowing in the wind
- jean shorts barely visible under the jersey
- chunky sneakers inspired by Retro Jordan 3 True Blue colors
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
            cap
            headphones
        jersey panels
```

### Flying Hero (MetroCity)

Flying superhero character (designed for MetroCity, swappable everywhere):

```ts
controller: 'flying-hero'
```

Like the retro-kid, this is a fully procedural, jointed character — but instead of a
walk cycle it holds a forward-leaning flight pose and runs a *flight idle*.

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

Scene id:

```ts
trippy-90s
```

This is the current baseline world:

- curved road on a planet-like surface
- melted/wobbly city buildings
- neon sidewalks and street markings
- striped sun
- floating music notes
- line-boil animation
- stop-motion character rhythm
- glowing footstep lights

This scene should remain visually stable while character work continues.

Future scenes should live in `src/lib/scenes/` and be registered in `src/lib/registry/scenes.ts`.

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
  walk: {              // ground walkers use the full set; flyers reuse a few fields
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
| `windStrength` | jersey/cloth billow strength |

## Performance notes

Current performance approach:

- one Three.js render loop owned by the active scene
- character updates are held to the scene’s stop-motion clock
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
- improve the oversized jersey wind motion
- tune walk cycle readability from behind
- polish character colors and outlines to better match the scene
- add better orientation/model inspection tooling

Next:

- add a character preset editor panel
- add scene presets and camera presets
- add export/share settings
- add GitHub Pages deployment workflow

Future:

- superhero flying scene
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
