# 2D Mode Redesign — Implementation Plan

> **For agentic workers:** Read `DESIGN-2D-MODE.md` in the project root before starting. It contains all technical detail, colour palettes, projection math, and code examples. This plan lists WHAT to do and in what order; the design doc explains WHY and HOW.
>
> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Redesign the 2D mode (formerly "Illustrated mode") scene backgrounds to match the concept design (`lo-fi_walk_concept_design.png`). The road layer and character layer are NOT touched. Only the three scene background modules and App.svelte (button rename) change.

**Tech Stack:** Svelte 5 (legacy syntax — use `on:click`, `$:`, not runes), TypeScript, Canvas 2D API, Vitest.

## Global Constraints

- All Svelte files must use legacy Svelte 4 syntax: `on:click`, `$:`, `class:` — NOT `$state`, `$derived`, `$effect`
- No external image assets — everything drawn with Canvas 2D primitives
- Do NOT modify: `stopMotion.ts`, `sketch.ts`, `types.ts`, `store.ts`, `road.ts`, `character2D.ts`, `ThreeStage.svelte`, or any registry files
- Vanishing point constants: `vpX = W * 0.5`, `vpY = H * 0.40` — must be consistent across all scene files and road.ts
- Run `npm run dev` to start dev server (port 5173)
- Run `npm test` to run unit tests

---

## File Map

| File | Action |
|---|---|
| `src/App.svelte` | Modify (one-line button rename) |
| `src/lib/illustrated/layers/buildingCorridor.ts` | **Create** |
| `src/lib/illustrated/layers/scenes/trippy90s2D.ts` | **Rewrite** |
| `src/lib/illustrated/layers/scenes/jungle2D.ts` | **Rewrite** |
| `src/lib/illustrated/layers/scenes/metropolis2D.ts` | **Rewrite** |

---

## Task 1: Rename the button

**File:** `src/App.svelte`

- [ ] **Step 1:** Find the `illustrated-toggle` button (currently line ~87). Change the button text:
  ```svelte
  {$illustratedMode ? '2D' : '3D'}
  ```
  (Was `{$illustratedMode ? 'illustrated' : '3D'}`)

- [ ] **Step 2:** Verify in browser — toggle button should read "2D" when in 3D mode (waiting to switch), "3D" when in 2D mode.

- [ ] **Step 3:** Commit
  ```bash
  git commit -m "feat: rename illustrated toggle to 2D"
  ```

---

## Task 2: Create buildingCorridor.ts

**File:** `src/lib/illustrated/layers/buildingCorridor.ts` (new file)

This is the shared corridor rendering engine used by all three scene modules. Read `DESIGN-2D-MODE.md` sections 7a–7d carefully before implementing.

**Interfaces to produce:**

```ts
export interface BuildingType {
  widthMult: number      // multiplied by base facadeW (W * 0.26 * depth)
  heightMult: number     // multiplied by base building height range
  windowCols: number
  windowRows: number
  accentColor?: string   // optional neon/rooftop accent
}

export interface CorridorStyle {
  buildingColor: string
  inkColor: string
  windowLit: string
  windowDark: string
  buildingTypes: BuildingType[]
}

export interface CorridorLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

export function createBuildingCorridor(style: CorridorStyle): CorridorLayer
```

**Key implementation details:**

- Import: `createStopMotionClock` from `'../stopMotion'`, `roughFill`, `seededRandom` from `'../sketch'`, `FrameState` from `'../types'`
- `SLAB_COUNT = 8` slabs per side
- `scrollClock = createStopMotionClock(8)` — 8fps discrete hops
- `SCROLL_STEP = 1 / (SLAB_COUNT * 3)` — approx 3-second full cycle
- Each slab `i` renders at depth `= ((i / SLAB_COUNT) + scrollProgress) % 1.0`
- Skip slabs with depth < 0.05 (invisible at horizon)
- Sort slabs by depth ascending before drawing (painter's algorithm: far first)
- Projection: `roadHalfW = W*0.42*d`, `facadeW = W*0.26*d*bType.widthMult`, `groundY = vpY+(H-vpY)*d`, `topY = groundY - H*0.70*d*bType.heightMult`
- Draw both left and right sides for each slab
- Windows: only when `facadeW > 8` and individual window size `> 2px` — see `DESIGN-2D-MODE.md` section 7d
- Use `roughFill` for the building rectangle, plain `ctx.fillRect` for window cells

- [ ] **Step 1:** Create the file with the `CorridorStyle`, `BuildingType`, `CorridorLayer` interfaces and `createBuildingCorridor` function

- [ ] **Step 2:** Implement the slab depth cycling and perspective projection

- [ ] **Step 3:** Implement `drawBuildingFacade` helper (rectangle + window grid)

- [ ] **Step 4:** Temporarily import the corridor into `trippy90s2D.ts` (before that file is rewritten) with a placeholder style to visually confirm the corridor renders. Can be a temporary debug test in `IllustratedStage.svelte` — just verify you see scrolling building facades on both sides of the road.

- [ ] **Step 5:** Remove any temporary debug code

- [ ] **Step 6:** Commit
  ```bash
  git commit -m "feat: add shared building corridor layer"
  ```

---

## Task 3: Rewrite trippy90s2D.ts

**File:** `src/lib/illustrated/layers/scenes/trippy90s2D.ts` (full rewrite)

This is the PRIMARY scene that should closely match `lo-fi_walk_concept_design.png`.

**What to draw (in order):**
1. Sky gradient: `#2a0854` (top) → `#7a1a7a` (mid) → `#e85020` (horizon = vpY). Fills `0` to `vpY`.
2. Striped sun: large circle at `(W*0.5, vpY*0.68)`, radius `min(W,H)*0.18`, warm yellow `#f5c040`, with 7–8 horizontal stripes through the bottom half matching the sky colour. See `DESIGN-2D-MODE.md` section 7e for the `drawStripedSun` and `lerpHex`/`lerpSkyColor` helper implementations.
3. Blob clouds: 3–4 ellipse clusters drifting right at 5fps (keep concept from old `trippy90s2D.ts` but update colours to purple `#7a3a8a` with `globalAlpha 0.55`)
4. Building corridor: `createBuildingCorridor(TRIPPY_CORRIDOR_STYLE)` — create the instance once in the module factory, call `.draw(ctx, state)` each frame.

**TRIPPY_CORRIDOR_STYLE:**
```ts
const TRIPPY_CORRIDOR_STYLE: CorridorStyle = {
  buildingColor: '#1a0840',
  inkColor: '#0d0420',
  windowLit: '#f0a820',
  windowDark: '#100828',
  buildingTypes: [
    { widthMult: 1.0, heightMult: 1.2, windowCols: 3, windowRows: 4 },
    { widthMult: 0.7, heightMult: 1.5, windowCols: 2, windowRows: 5 },
    { widthMult: 1.3, heightMult: 0.9, windowCols: 4, windowRows: 3 },
  ]
}
```

- [ ] **Step 1:** Delete all existing content of `trippy90s2D.ts`
- [ ] **Step 2:** Implement sky gradient, cloud blobs, `drawStripedSun` helper, and corridor instantiation
- [ ] **Step 3:** Visual test — should closely resemble the concept image: purple/orange sky, large striped sun, purple buildings with amber windows scrolling past
- [ ] **Step 4:** Commit
  ```bash
  git commit -m "feat: rewrite Trippy 90s 2D scene with corridor + striped sun"
  ```

---

## Task 4: Rewrite jungle2D.ts

**File:** `src/lib/illustrated/layers/scenes/jungle2D.ts` (full rewrite)

**What to draw (in order):**
1. Sky gradient: `#3a1400` (top) → `#7a3000` (mid) → `#e06020` (horizon). Fills `0` to `vpY`.
2. Building corridor with jungle style (dark tree shapes). See `JUNGLE_CORRIDOR_STYLE` below.
3. Firefly dots: 10–12 bright dots (`#aaff88`, radius 2–3px) scattered above `vpY`, blinking on/off with `fireflyClock = createStopMotionClock(4)`. Each firefly has a fixed (seeded) position; its on/off state is `seededRandom(seed + fireflyFrame * 0.7) > 0.4`. When on, also draw a soft glow ring (`globalAlpha 0.15`, radius ×3).
4. Dappled light patches on road: 6–8 semi-transparent warm ellipses (`rgba(255,200,80,0.12)`) in the road area (`y > vpY`). Positions snap each `lightClock.tick(t)` at 6fps: `lx = W*(0.15 + seededRandom(seed + lightFrame*11) * 0.7)`.

**JUNGLE_CORRIDOR_STYLE:**
```ts
const JUNGLE_CORRIDOR_STYLE: CorridorStyle = {
  buildingColor: '#0a1a04',
  inkColor: '#050e02',
  windowLit: '#aaff88',   // firefly dots used as "lit windows"
  windowDark: '#0a1a04',
  buildingTypes: [
    { widthMult: 0.5, heightMult: 1.1, windowCols: 2, windowRows: 1 },
    { widthMult: 0.8, heightMult: 0.9, windowCols: 3, windowRows: 1 },
    { widthMult: 0.6, heightMult: 1.3, windowCols: 2, windowRows: 2 },
  ]
}
```

Note: the corridor "windows" in jungle mode act as firefly dots embedded in the tree facade. The sparse `windowRows: 1–2` means only 1–2 bright dots per building slab, which reads as fireflies rather than structured windows.

- [ ] **Step 1:** Delete existing content, implement sky + corridor + fireflies + dappled light
- [ ] **Step 2:** Visual test — amber sky, dark tree silhouette corridor scrolling, fireflies blinking in canopy
- [ ] **Step 3:** Commit
  ```bash
  git commit -m "feat: rewrite Jungle 2D scene with tree corridor"
  ```

---

## Task 5: Rewrite metropolis2D.ts

**File:** `src/lib/illustrated/layers/scenes/metropolis2D.ts` (full rewrite)

**What to draw (in order):**
1. Sky gradient: `#050810` (top) → `#0a1428` (horizon). Fills `0` to `vpY`.
2. Building corridor with metropolis style. See `METRO_CORRIDOR_STYLE` below.
3. Neon signs: 3–4 small coloured rectangles drawn on the building facades, cycling hue at 12fps (`neonClock = createStopMotionClock(12)`). Position them at seeded x/y locations in the upper portion of the corridor area. Use `hsl(${Math.round(seededRandom(seed + neonFrame * 0.11) * 360)}, 100%, 55%)`.
4. Smog band: A semi-transparent horizontal band (`rgba(100,130,170,0.12)`) at approx `y = vpY * 0.9`, height `vpY * 0.08`. The band shifts position slightly each `smogClock.tick(t)` at 3fps — offset `= (smogFrame % 8) * W * 0.03`.

**METRO_CORRIDOR_STYLE:**
```ts
const METRO_CORRIDOR_STYLE: CorridorStyle = {
  buildingColor: '#101820',
  inkColor: '#080e14',
  windowLit: '#44aaff',
  windowDark: '#0a1018',
  buildingTypes: [
    { widthMult: 1.0, heightMult: 1.2, windowCols: 4, windowRows: 4, accentColor: '#ff44aa' },
    { widthMult: 0.8, heightMult: 1.5, windowCols: 3, windowRows: 5, accentColor: '#44ffcc' },
    { widthMult: 1.2, heightMult: 0.9, windowCols: 5, windowRows: 3, accentColor: '#ffaa00' },
  ]
}
```

- [ ] **Step 1:** Delete existing content, implement sky + corridor + neon signs + smog
- [ ] **Step 2:** Visual test — near-black sky, dark industrial towers with cool blue windows, neon colour cycling visible, smog band
- [ ] **Step 3:** Commit
  ```bash
  git commit -m "feat: rewrite Metropolis 2D scene with tower corridor"
  ```

---

## Task 6: Cross-scene verification + final polish

- [ ] **Step 1:** With `npm run dev` running, switch to 2D mode. Cycle through all three scenes. Verify:
  - Each scene is visually distinct
  - Buildings scroll continuously (not static)
  - Road and character render correctly on top
  - Toggle back to 3D works without errors
  - Button reads "2D" / "3D" correctly

- [ ] **Step 2:** Run `npm test` — existing tests must still pass (no changes to tested modules)

- [ ] **Step 3:** Commit any final adjustments
  ```bash
  git commit -m "fix: 2D mode visual polish"
  ```

---

## Visual Checklist (definition of done)

- [ ] Toggle button reads "2D" (not "illustrated")
- [ ] Trippy 90s: purple/magenta/orange sky, giant striped sun, purple buildings with amber windows, buildings scroll creating infinite walk feeling
- [ ] Jungle: amber sky, dark tree corridor, fireflies blinking in canopy, dappled light on road
- [ ] Metropolis: near-black sky, dark steel towers with blue windows, neon cycling, smog band
- [ ] All scenes: buildings present on both LEFT and RIGHT sides of road
- [ ] Character and road unchanged and correctly layered on top
- [ ] No console errors during scene switching
- [ ] `npm test` passes
