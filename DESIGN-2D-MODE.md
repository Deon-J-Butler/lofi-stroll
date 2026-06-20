# Lo-Fi Stroll Studio — 2D Mode Redesign
> **For AI agents:** Read this entire document before touching any code. It is the authoritative design brief for the 2D mode (formerly "Illustrated mode") redesign. Start at section 1 and do not skip.

---

## 1. Project Overview

**Lo-Fi Stroll Studio** is a browser-based ambient animation app. A character (chibi/cartoon, viewed from behind) walks perpetually while lofi music plays. The user can choose between three scenes and characters from a studio panel.

The app runs at `http://localhost:5173` via `npm run dev`. It is a Svelte 5 app (legacy syntax — see constraints below) with TypeScript and Vite.

There are two rendering modes:
- **3D mode** (default): Three.js scenes with a 3D walking character
- **2D mode** (formerly "Illustrated mode"): Canvas 2D renderer, hand-sketched stop-motion aesthetic

The user switches between modes using a toggle button in the studio panel. This document describes a **full redesign of the 2D mode** to match the project's original concept design.

---

## 2. Tech Stack & Hard Constraints

| Item | Value |
|---|---|
| Framework | Svelte 5, **legacy syntax only** |
| Language | TypeScript |
| Bundler | Vite |
| Renderer (2D mode) | Canvas 2D API — no Three.js, no image assets |
| Svelte syntax | **Use `on:click`, `$:`, `class:` — NOT Svelte 5 runes (`$state`, `$derived`, etc.)** |
| Scene IDs | Exactly `'trippy-90s'`, `'jungle'`, `'metropolis'` |
| No external assets | Everything drawn with Canvas 2D primitives |
| Tests | Vitest — run `npm test` |

---

## 3. Existing Code Structure

```
src/
  App.svelte                       — main app; toggle wires 3D ↔ 2D
  lib/
    illustrated/
      IllustratedStage.svelte      — canvas element + render loop
      store.ts                     — illustratedMode writable<boolean>
      types.ts                     — FrameState interface
      stopMotion.ts                — StopMotionClock (discrete-frame timing)
      sketch.ts                    — seededRandom, jitterLine, roughFill, hatchShadow
      layers/
        road.ts                    — shared perspective road + lane markings
        character2D.ts             — 8-pose walk cycle character (chibi, from behind)
        scenes/
          trippy90s2D.ts           — Trippy 90s background (NEEDS FULL REWRITE)
          jungle2D.ts              — Jungle background (NEEDS FULL REWRITE)
          metropolis2D.ts          — Metropolis background (NEEDS FULL REWRITE)
    components/
      ThreeStage.svelte            — 3D renderer (do not touch)
    registry/
      scenes.ts                    — scene registry (IDs, labels, descriptions)
      characters.ts                — character registry
```

### Key interfaces you will use everywhere

```ts
// src/lib/illustrated/types.ts
export interface FrameState {
  t: number           // elapsed seconds since render started
  sceneId: string     // 'trippy-90s' | 'jungle' | 'metropolis'
  canvasW: number
  canvasH: number
}

// src/lib/illustrated/stopMotion.ts
export interface StopMotionClock {
  tick(realTime: number): number  // returns monotonically increasing integer frame count
  reset(): void
}
export function createStopMotionClock(fps: number): StopMotionClock
```

### Sketch utilities (src/lib/illustrated/sketch.ts)

```ts
seededRandom(seed: number): number                         // deterministic [0, 1)
jitterLine(ctx, x0, y0, x1, y1, seed, amount): void       // line with per-frame boil
roughFill(ctx, points: [number,number][], fill, ink, seed) // flat fill + jittered outline
hatchShadow(ctx, x, y, w, h, seed, density?)              // diagonal shadow hatching
```

All of these already exist and are tested. Import and use them rather than reimplementing.

### Render loop (IllustratedStage.svelte)

The current render loop calls, in order:
1. `scene.draw(ctx, state)` — scene-specific background
2. `road.draw(ctx, state)` — shared perspective road
3. `character.draw(ctx, state)` — walking character

The redesign will add a new layer **between** the scene background and the road:
- `buildingCorridor.draw(ctx, state)` — the scrolling building facades (per-scene instance)

You will pass the corridor instance as part of each scene's drawing, not as a separate top-level layer (because each scene owns its own CorridorStyle config).

---

## 4. The Concept Design

**Image file:** `lo-fi_walk_concept_design.png` in the project root.

Always read this image before touching any visual code. Here is what it shows:

### Main scene (centre of the image):
- A chibi character is viewed **from behind**, walking away from the viewer, down the centre of a city street
- The road has a clear **vanishing point** at the centre-horizon
- **Buildings flank both sides of the road** — they form a tight urban corridor, not distant background scenery. The nearest buildings are tall and close, filling the sides of the frame
- The sky is **deep purple/magenta at top, warm orange at the horizon**
- A **giant retro sun** sits at or near the vanishing point. Crucially: the sun has **horizontal stripe cuts** through it (the classic 80s/90s synthwave striped sun aesthetic) — NOT a plain solid circle
- Building **windows glow warm orange/amber** — the buildings are not flat silhouettes; they have lit windows
- **Floating music notes** drift upward from the character
- The overall palette: `#2a0854` (deep purple) → `#7a1a7a` (magenta) → `#e85020` (warm orange) sky; `#f5c040` sun; `#f0a820` window glow; `#1a0840` building walls

### Style notes (written on the concept page):
- Studio Ghibli-esque background and lighting
- Teen Titans Go! simplified characters
- 80s/90s colour palette
- Loopy bending perspective (things can be slightly stylised/exaggerated)
- Bold outlines
- Music notes floating

### Bottom thumbnail strip (concept page):
Shows 6 variations: loopy road perspective / melting sky / the main street scene / loopy buildings / music notes / city glow with simple lighting. These are all the SAME scene styled differently. Use the main centre image as the design target.

---

## 5. What Is Wrong With the Current 2D Implementation

The current scene backgrounds do NOT match the concept. Specifically:

| Problem | Current | Should be |
|---|---|---|
| Building placement | Far background silhouettes | Flanking corridor walls on both sides of the road |
| Scroll/motion | Buildings are static | Buildings scroll outward from VP — simulating infinite forward walk |
| Sun | Small plain circle | Giant (H×0.18 radius) retro sun with horizontal stripe cuts |
| Window glow | None — flat silhouettes | Warm amber/orange lit windows |
| Composition | Open road, buildings far away | Tight urban corridor |
| Jungle | Flat tree backgrounds | Tree trunks + canopy as corridor walls |
| Metropolis | Some neon elements | Dark industrial tower corridor |

The **road layer** and **character layer** are correct and must not be replaced, only the scene backgrounds change.

---

## 6. Approved Design

### 6a. Rename the toggle button

In `src/App.svelte`, change the toggle button text:
```svelte
<!-- BEFORE -->
{$illustratedMode ? 'illustrated' : '3D'}

<!-- AFTER -->
{$illustratedMode ? '2D' : '3D'}
```

That is the ONLY change to App.svelte. The store name, component name, and CSS class stay as-is.

### 6b. The core visual change: perspective corridor scroll

Replace all three scene background files with a new approach:
1. A new shared file `src/lib/illustrated/layers/buildingCorridor.ts` implements the perspective corridor
2. Each scene file (trippy90s2D.ts, jungle2D.ts, metropolis2D.ts) is rewritten to:
   - Draw its own sky
   - Draw its own special elements (striped sun, fireflies, smog, etc.)
   - Call the corridor with a scene-specific `CorridorStyle` config

### 6c. The three scene variants

| Scene | Corridor wall type | Sky | Special elements |
|---|---|---|---|
| Trippy 90s | Purple city buildings, amber windows | Purple→magenta→orange | Giant striped retro sun at VP |
| Jungle | Tree trunks + canopy blob tops | Dark amber→warm orange | Fireflies, dappled light patches on road |
| Metropolis | Dark steel-blue towers, cool windows | Near-black→dark navy | Cycling neon signs, smog band |

---

## 7. Technical Architecture

### 7a. Perspective Projection Constants

All scene backgrounds share the same vanishing point:
```ts
const vpX = W * 0.5    // horizontal center
const vpY = H * 0.40   // 40% down the canvas
```

At depth `d` (0 = horizon/far, 1 = near viewer), the world scales linearly:
```ts
const roadHalfW = W * 0.42 * d   // half-width of road at depth d
const facadeW   = W * 0.26 * d   // building facade width at depth d
const groundY   = vpY + (H - vpY) * d   // ground line at depth d
const buildingTopY = groundY - H * 0.70 * d  // top of building (can go above canvas)
```

For left-side buildings:
```ts
const rightEdge = vpX - roadHalfW   // building meets road kerb
const leftEdge  = rightEdge - facadeW
```

For right-side buildings (mirror):
```ts
const leftEdge  = vpX + roadHalfW
const rightEdge = leftEdge + facadeW
```

**Important**: clamp `leftEdge` to `Math.max(-facadeW * 0.5, leftEdge)` and `rightEdge` to `Math.min(W + facadeW * 0.5, rightEdge)` to allow buildings to bleed slightly off-screen at close depths, which looks more natural.

### 7b. The Infinite Scroll Technique

```ts
const SLAB_COUNT = 8    // building segments per side
const SCROLL_STEP = 1 / (SLAB_COUNT * 3)  // depth units per scroll tick
                                            // → full cycle = SLAB_COUNT * 3 ticks
                                            // at 8fps scroll clock → ~3 seconds per cycle

// In the render function:
const scrollFrame = scrollClock.tick(t)
const scrollProgress = (scrollFrame * SCROLL_STEP) % 1.0

// Each slab i gets a rendered depth:
for (let i = 0; i < SLAB_COUNT; i++) {
  const depth = ((i / SLAB_COUNT) + scrollProgress) % 1.0
  if (depth < 0.05) continue  // skip slabs nearly at horizon (invisible)
  drawSlabAtDepth(depth, i)
}

// Draw order: sort slabs by depth ascending (draw far first)
// This ensures nearer slabs paint over farther ones (painter's algorithm)
```

Each slab `i` has a pre-assigned `buildingType` and `seed` so its appearance is consistent across frames:
```ts
const buildingType = i % numBuildingTypes
const seed = i * 17.3   // stable per-slab seed
```

### 7c. The CorridorStyle Interface

```ts
// src/lib/illustrated/layers/buildingCorridor.ts

export interface BuildingType {
  widthMult: number    // multiplied by base facadeW
  heightMult: number   // multiplied by base buildingTopY range
  windowCols: number   // window columns
  windowRows: number   // window rows (baseline; scales with height)
  accentColor?: string // optional rooftop accent or sign color
}

export interface CorridorStyle {
  buildingColor: string    // wall fill
  inkColor: string         // outline/ink
  windowLit: string        // lit window colour
  windowDark: string       // unlit window colour
  buildingTypes: BuildingType[]
}

export interface CorridorLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

export function createBuildingCorridor(style: CorridorStyle): CorridorLayer
```

### 7d. Window Drawing

Windows are a grid of small rectangles. Only drawn when the building is large enough (depth > 0.15 and pixel width > 6px):

```ts
function drawWindows(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, bw: number, bh: number,
  bType: BuildingType, seed: number, style: CorridorStyle
) {
  const cols = bType.windowCols
  const rows = Math.max(1, Math.round(bType.windowRows * (bh / (bw * 2 || 1))))
  const winW = (bw * 0.5) / cols
  const winH = (bh * 0.5) / rows
  if (winW < 2 || winH < 2) return

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = bx + (bw / (cols + 1)) * (c + 1)
      const wy = by + (bh / (rows + 1)) * (r + 1)
      const isLit = seededRandom(seed + r * 11 + c * 3.7) > 0.32
      ctx.fillStyle = isLit ? style.windowLit : style.windowDark
      ctx.fillRect(wx - winW / 2, wy - winH / 2, winW, winH)
    }
  }
}
```

### 7e. Striped Sun (Trippy 90s scene)

The 80s/90s retro sun: a large circle with horizontal stripe cuts that reveal the sky behind it.

```ts
function drawStripedSun(
  ctx: CanvasRenderingContext2D,
  sunX: number, sunY: number, sunR: number,
  skyGradientColors: { stop: number; color: string }[]
) {
  // 1. Draw sun body
  ctx.save()
  ctx.beginPath()
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
  ctx.clip()  // clip subsequent draws to sun circle

  ctx.fillStyle = '#f5c040'
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2)

  // 2. Draw horizontal stripes OVER the sun in the sky's colour
  //    Stripes are in the BOTTOM HALF of the sun (classic look)
  const STRIPE_COUNT = 8
  for (let i = 0; i < STRIPE_COUNT; i++) {
    const t = i / STRIPE_COUNT
    const sy = sunY + t * sunR  // stripes only in bottom half
    const stripeH = (sunR / STRIPE_COUNT) * 0.38
    // Interpolate sky colour at this Y position
    const skyColor = lerpSkyColor(sy, sunY - sunR, sunY + sunR, skyGradientColors)
    ctx.fillStyle = skyColor
    ctx.fillRect(sunX - sunR - 2, sy, sunR * 2 + 4, stripeH)
  }

  ctx.restore()

  // 3. Bold outline
  ctx.beginPath()
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
  ctx.strokeStyle = '#c85010'
  ctx.lineWidth = Math.max(2, sunR * 0.04)
  ctx.stroke()
}

// Helper: linearly interpolate between sky gradient stops
function lerpSkyColor(
  y: number, topY: number, botY: number,
  stops: { stop: number; color: string }[]
): string {
  const t = Math.max(0, Math.min(1, (y - topY) / (botY - topY)))
  // find surrounding stops and lerp
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].stop && t <= stops[i + 1].stop) {
      const localT = (t - stops[i].stop) / (stops[i + 1].stop - stops[i].stop)
      return lerpHex(stops[i].color, stops[i + 1].color, localT)
    }
  }
  return stops[stops.length - 1].color
}

function lerpHex(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16)
  const bh = parseInt(b.slice(1), 16)
  const ar = (ah >> 16) & 0xff; const ag = (ah >> 8) & 0xff; const ab = ah & 0xff
  const br = (bh >> 16) & 0xff; const bg = (bh >> 8) & 0xff; const bb = bh & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const b2 = Math.round(ab + (bb - ab) * t)
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b2.toString(16).padStart(2,'0')}`
}
```

The sun should be **large**: `sunR = Math.min(W, H) * 0.18` and positioned at `sunY = vpY * 0.70` (near but above the horizon).

### 7f. Jungle Tree Corridor

For the Jungle scene, replace building facades with tree structures:
- **Trunk**: A narrow vertical dark rectangle from ground to ~70% of the building height
- **Canopy blob**: An irregular ellipse (use multiple overlapping ctx.arc calls) at the top of the trunk
- **No windows** — instead, use a few `seededRandom`-based bright dots to simulate fireflies within the canopy

Use the same projection math as building facades (same `roadHalfW`, `facadeW`, `groundY`).

CorridorStyle for jungle:
```ts
{
  buildingColor: '#0a1a04',  // dark trunk/foliage
  inkColor: '#050e02',
  windowLit: '#aaff88',      // firefly glow (treated as "window lit")
  windowDark: '#0a1a04',
  buildingTypes: [
    { widthMult: 0.5, heightMult: 1.1, windowCols: 2, windowRows: 1 },  // tall thin tree
    { widthMult: 0.8, heightMult: 0.9, windowCols: 3, windowRows: 1 },  // wide tree cluster
    { widthMult: 0.6, heightMult: 1.3, windowCols: 2, windowRows: 2 },  // very tall tree
  ]
}
```

The tree-specific drawing: in the `drawBuildingFacade` function, when `scene === 'jungle'`, draw the lower 65% of the facade as a thin trunk and the upper 35% as a canopy blob. The `drawWindows` call draws 2–3 small bright dots (fireflies) randomly placed in the canopy region.

Since the jungle scene is a simple style variant, the cleanest implementation is to accept a `drawFacade` callback on CorridorStyle rather than hardcoding building-only rendering. See section 8 for the actual file structure.

### 7g. Metropolis Tower Corridor

CorridorStyle for metropolis:
```ts
{
  buildingColor: '#101820',  // dark steel blue
  inkColor: '#080e14',
  windowLit: '#44aaff',      // cool blue window glow
  windowDark: '#0a1018',
  buildingTypes: [
    { widthMult: 1.0, heightMult: 1.2, windowCols: 4, windowRows: 4, accentColor: '#ff44aa' },
    { widthMult: 0.8, heightMult: 1.5, windowCols: 3, windowRows: 5, accentColor: '#44ffcc' },
    { widthMult: 1.2, heightMult: 0.9, windowCols: 5, windowRows: 3, accentColor: '#ffaa00' },
  ]
}
```

The `accentColor` is used to draw a small neon sign rectangle near the rooftop. A separate `neonClock` (12fps) cycles which colour to show.

---

## 8. Complete File Map

### Files to MODIFY

| File | Change |
|---|---|
| `src/App.svelte` | Button text: `'illustrated'` → `'2D'` (one line) |
| `src/lib/illustrated/IllustratedStage.svelte` | Import and instantiate the new scene modules |

### Files to CREATE

| File | Purpose |
|---|---|
| `src/lib/illustrated/layers/buildingCorridor.ts` | Shared corridor rendering engine |

### Files to REWRITE (delete contents, start fresh)

| File | New purpose |
|---|---|
| `src/lib/illustrated/layers/scenes/trippy90s2D.ts` | Sky gradient + striped sun + calls corridor |
| `src/lib/illustrated/layers/scenes/jungle2D.ts` | Amber sky + fireflies + calls tree corridor |
| `src/lib/illustrated/layers/scenes/metropolis2D.ts` | Dark sky + smog + neon + calls tower corridor |

### Files NOT to touch

- `src/lib/illustrated/stopMotion.ts` — correct, do not change
- `src/lib/illustrated/sketch.ts` — correct, do not change
- `src/lib/illustrated/types.ts` — correct, do not change
- `src/lib/illustrated/store.ts` — correct, do not change
- `src/lib/illustrated/layers/road.ts` — correct, do not change
- `src/lib/illustrated/layers/character2D.ts` — correct, do not change
- `src/lib/components/ThreeStage.svelte` — 3D renderer, do not touch
- `src/lib/registry/*` — do not touch

---

## 9. Colour Palette Reference

### Trippy 90s
```
Sky top:       #2a0854  (deep purple)
Sky mid:       #7a1a7a  (magenta)
Sky horizon:   #e85020  (warm orange)
Sun fill:      #f5c040  (warm yellow)
Sun outline:   #c85010
Building wall: #1a0840
Building ink:  #0d0420
Window lit:    #f0a820  (warm amber glow)
Window dark:   #100828
Road:          (from road.ts — don't override)
```

### Jungle
```
Sky top:       #3a1400  (near-black amber)
Sky mid:       #7a3000  (dark burnt orange)
Sky horizon:   #e06020  (warm orange)
Tree dark:     #0a1a04
Tree ink:      #050e02
Firefly:       #aaff88
Dappled light: rgba(255, 200, 80, 0.12)
```

### Metropolis
```
Sky top:       #050810  (near-black)
Sky low:       #0a1428  (dark navy)
Building wall: #101820  (dark steel blue)
Building ink:  #080e14
Window lit:    #44aaff  (cool blue)
Window dark:   #0a1018
Smog:          rgba(100, 130, 170, 0.12)
Neon 1:        #ff44aa  (pink)
Neon 2:        #44ffcc  (cyan)
Neon 3:        #ffaa00  (amber)
```

---

## 10. Specific Visual Targets Per Scene

### Trippy 90s — match the concept image closely
- Sky fills the upper 40% of canvas (to vpY)
- Giant sun: radius = `Math.min(W, H) * 0.18`, centre at `(W*0.5, vpY * 0.68)`
- 7–8 horizontal stripes cut through the bottom half of the sun
- Building corridor uses `SLAB_COUNT = 8`, scroll at `8fps`, ~3 sec per cycle
- 3–4 blob clouds drifting right in discrete 5fps hops (keep from current implementation, just update colours to match palette)
- No separate cloud layer for the other two scenes

### Jungle
- Sky fills upper 40%
- No sun — replace with subtle warm haze near horizon
- Tree corridor: same slab count and scroll speed
- 10–12 firefly dots scattered in the canopy zone (above vpY), blinking at 4fps
- Dappled light patches on road (semi-transparent warm ellipses, snapping at 6fps)

### Metropolis
- Sky fills upper 40%
- Smog band: semi-transparent `rgba(100,130,170,0.12)` horizontal strip at ~vpY * 0.85, scrolling slowly
- 3–4 neon signs drawn on the building facades that cycle hue at 12fps (use `accentColor` from BuildingType)
- Faint cityscape haze: slight blur-like gradient over the horizon buildings (achieved by drawing a semi-transparent dark rectangle over the deepest slabs)

---

## 11. IllustratedStage Render Order (after redesign)

```
1. scene.draw(ctx, state)  — sky + special elements (sun, smog, etc.) + corridor
2. road.draw(ctx, state)   — perspective road over the corridor base
3. character.draw(ctx, state) — character on top of road
```

The corridor is now drawn INSIDE the scene module (not as a separate top-level call), because the corridor config varies per scene.

---

## 12. Implementation Task Order

Implement in this exact order (each task is independently testable):

### Task 1: Rename the button
- File: `src/App.svelte`
- Change: `'illustrated'` → `'2D'` in the button text
- Test: Toggle button shows "2D" when in 3D mode, "3D" when not (wait, re-read App.svelte — actually the label shows what MODE you'll switch TO or what mode is ACTIVE. Check current label logic before assuming)
- Commit: `git commit -m "feat: rename illustrated toggle to 2D"`

### Task 2: Create buildingCorridor.ts
- File: `src/lib/illustrated/layers/buildingCorridor.ts`
- Implements `CorridorStyle`, `BuildingType`, `CorridorLayer`, `createBuildingCorridor()`
- Uses `createStopMotionClock`, `roughFill`, `seededRandom` from existing utilities
- The corridor draws building facades (rectangles with window grids) on both sides of the road
- Projection constants: `vpX = W*0.5`, `vpY = H*0.40`, depths 0→1
- Test visually: temporarily render the corridor in trippy90s2D.ts with placeholder sky
- Commit: `git commit -m "feat: add shared building corridor layer"`

### Task 3: Rewrite trippy90s2D.ts
- Full rewrite of `src/lib/illustrated/layers/scenes/trippy90s2D.ts`
- Sky gradient (purple → magenta → orange)
- Striped sun (`drawStripedSun` helper, include `lerpHex` / `lerpSkyColor`)
- Cloud blobs (keep from old implementation but update colours)
- Calls `corridor.draw(ctx, state)` (corridor instance created in constructor, uses Trippy 90s CorridorStyle)
- Test: Select "Trippy 90s" scene, toggle 2D mode — should resemble concept image
- Commit: `git commit -m "feat: rewrite Trippy 90s 2D scene with corridor + striped sun"`

### Task 4: Rewrite jungle2D.ts
- Full rewrite of `src/lib/illustrated/layers/scenes/jungle2D.ts`
- Amber sky gradient
- Firefly dots (10–12, blinking at 4fps)
- Dappled light patches on road (6fps)
- Calls `corridor.draw()` with jungle CorridorStyle (dark tree colours, firefly "windows")
- Commit: `git commit -m "feat: rewrite Jungle 2D scene with tree corridor"`

### Task 5: Rewrite metropolis2D.ts
- Full rewrite of `src/lib/illustrated/layers/scenes/metropolis2D.ts`
- Dark sky gradient
- Smog band (slow, horizontal, semi-transparent)
- Neon signs drawn on building facades (via corridor `accentColor`)
- Calls `corridor.draw()` with metropolis CorridorStyle
- Commit: `git commit -m "feat: rewrite Metropolis 2D scene with tower corridor"`

### Task 6: Cross-scene test + final polish
- Run dev server, toggle all three scenes in 2D mode
- Verify: corridor scrolls (infinite walk feel), buildings have lit windows, each scene is visually distinct
- Verify: switching back to 3D mode works
- Verify: the "2D" button label is correct
- Commit any polish changes

---

## 13. Stop-Motion Clock Rates Reference

| Element | fps |
|---|---|
| Building corridor scroll | 8 |
| Character walk poses | 8 (unchanged) |
| Road lane markings | 8 (unchanged) |
| Cloud drift | 5 |
| Firefly blink | 4 |
| Dappled light snap | 6 |
| Neon sign cycle | 12 |
| Smog drift | 3 |

---

## 14. Testing the Visual Result

After implementing, the 2D mode should pass this visual checklist:

- [ ] Toggle button reads "2D" (not "illustrated")
- [ ] Trippy 90s: purple/magenta/orange sky, giant striped sun at centre, purple buildings with amber windows flanking the road, buildings scroll continuously
- [ ] Jungle: amber sky, dark tree corridors flanking road, fireflies visible in canopy zone, dappled light on road
- [ ] Metropolis: near-black sky, dark steel towers with blue-tinted windows, neon colour cycling visible, smog band
- [ ] All scenes: buildings scroll continuously (not static), creating the "walking through" feel
- [ ] Character remains centred and animating (unchanged)
- [ ] Road layer draws correctly on top of corridor
- [ ] Switching between scenes while in 2D mode works
- [ ] Switching between 3D and 2D modes works without errors

---

*Document written: 2026-06-20. Approved design from brainstorming session. See `docs/superpowers/specs/2026-06-20-2d-mode-redesign.md` for the formal spec.*
