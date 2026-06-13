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
- Keep the uploaded fox/chibi GLB as a reference asset only.
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
    characters.ts  registered characters: retro-kid default, fox-chibi reference
    scenes.ts      registered scenes: trippy-90s
    presets.ts     scene + character combinations

  scenes/        world builders
    createTrippy90sScene.ts

  characters/    character controllers
    controller.ts            shared CharacterController contract
    index.ts                 controller factory
    createRetroKidWalker.ts  custom procedural 90s chibi walker
    createFoxChibiWalker.ts  static GLB reference walker
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

### Fox Chibi GLB Reference

Reference character:

```ts
controller: 'glb-walker'
```

This is the uploaded AI-generated chibi GLB. It is kept for comparison because it helped establish rough scale, chibi proportions, and cloak-like fabric motion.

The model should **not** be treated as the final character pipeline. It has been inspected as a static single-mesh GLB with no usable skeleton or animation clips, so it cannot produce a real walk cycle without rebuilding or rigging.

Use it as:

- silhouette reference
- scale reference
- temporary comparison asset
- reminder of the cloak/fabric motion that inspired the oversized jersey

Do not use it as the final walking character unless it is replaced with a properly rigged version.

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

1. Drop model assets into:

```txt
public/assets/characters/<id>/source/
```

2. Inspect GLBs before wiring them into the scene:

```bash
node scripts/inspect-glb.mjs public/assets/characters/<id>/source/model.glb
```

Check for:

- animations
- skeletons/skins
- mesh hierarchy
- bounds
- front/back orientation

3. Register the character in `src/lib/registry/characters.ts`:

```ts
{
  id: 'my-character',
  label: 'My Character',
  controller: 'glb-walker',
  modelUrl: '/assets/characters/my-character/source/model.glb',
  rotationY: 0,
  scale: 1,
  position: { x: 0, y: 0, z: 0 },
  walk: {
    strideHz: 1.25,
    legSwing: 0.55,
    windStrength: 1
  },
  stepGlow: {
    enabled: true,
    size: 0.62,
    intensity: 0.5,
    rimLight: true
  },
  debug: false,
  status: 'ready'
}
```

4. For a new procedural or rigged character:

- implement a builder that returns `CharacterController`
- add the controller kind to `ControllerKind`
- register the builder in `src/lib/characters/index.ts`
- reuse `sampleWalkPose` for gait math
- reuse `createStepGlowRig` for ground glow

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
