# Illustrated Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable Canvas 2D "illustrated mode" to Lo-Fi Stroll Studio that renders every element — character, road, and scene-specific backgrounds — in a hand-sketched stop-motion style matching the original concept design.

**Architecture:** A `illustratedMode` Svelte store controls which renderer is active. `App.svelte` renders both `ThreeStage` and `IllustratedStage` but hides the inactive one via `display:none`. `IllustratedStage` owns a `<canvas>` running a Canvas 2D render loop; each frame dispatches to a scene-specific background function, then draws the shared road, then the character. All animated elements use `StopMotionClock` instances to advance at discrete fps rates, producing the flipbook feel.

**Tech Stack:** Svelte 5 (legacy syntax), TypeScript, Canvas 2D API, Vitest (added in Task 1)

## Global Constraints

- All Svelte files use legacy Svelte 4 syntax (`on:click`, `$:`, `class:`) — do not use Svelte 5 runes
- Scene IDs are exactly: `'trippy-90s'`, `'jungle'`, `'metropolis'`
- No external image assets — everything drawn programmatically with Canvas 2D
- Match the character palette from the existing 3D character: skin `#96603c`, hoodie `#111111`, denim `#3b5a8f`, sneakers `#161616` with cream `#e7e0d0` and red `#c24a5a` accents
- Run `npm run dev` to start the dev server (port 5173 by default)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/illustrated/stopMotion.ts` | Create | StopMotionClock: discrete-frame timing |
| `src/lib/illustrated/sketch.ts` | Create | seededRandom, jitterLine, roughFill, hatchShadow |
| `src/lib/illustrated/types.ts` | Create | FrameState interface shared by all layers |
| `src/lib/illustrated/store.ts` | Create | illustratedMode writable store |
| `src/lib/illustrated/IllustratedStage.svelte` | Create | Canvas element + render loop |
| `src/lib/illustrated/layers/road.ts` | Create | Shared perspective road + scrolling lane markings |
| `src/lib/illustrated/layers/character2D.ts` | Create | Hand-drawn chibi character + 8-pose walk cycle |
| `src/lib/illustrated/layers/scenes/trippy90s2D.ts` | Create | 90s sky, sun, radial lines, silhouettes, clouds |
| `src/lib/illustrated/layers/scenes/jungle2D.ts` | Create | Canopy silhouettes, dappled light, fireflies |
| `src/lib/illustrated/layers/scenes/metropolis2D.ts` | Create | Skyline, smog, billboards, neon glow |
| `src/App.svelte` | Modify | Add illustratedMode toggle button + conditional IllustratedStage |
| `vitest.config.ts` | Create | Vitest config for unit tests |
| `src/lib/illustrated/stopMotion.test.ts` | Create | StopMotionClock unit tests |
| `src/lib/illustrated/sketch.test.ts` | Create | seededRandom determinism tests |

---

### Task 1: Vitest setup + StopMotionClock

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/illustrated/stopMotion.ts`
- Create: `src/lib/illustrated/stopMotion.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface StopMotionClock { tick(realTime: number): number; reset(): void }
  function createStopMotionClock(fps: number): StopMotionClock
  ```

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest
```

- [ ] **Step 2: Create vitest config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node' } })
```

- [ ] **Step 3: Add test script to package.json**

Modify `package.json` scripts section:
```json
"scripts": {
  "dev": "vite --host 0.0.0.0",
  "build": "vite build",
  "preview": "vite preview --host 0.0.0.0",
  "test": "vitest run"
}
```

- [ ] **Step 4: Write the failing test**

```ts
// src/lib/illustrated/stopMotion.test.ts
import { describe, it, expect } from 'vitest'
import { createStopMotionClock } from './stopMotion'

describe('createStopMotionClock', () => {
  it('returns 0 before any interval elapses', () => {
    const clock = createStopMotionClock(8)
    expect(clock.tick(0)).toBe(0)
    expect(clock.tick(0.05)).toBe(0)
  })

  it('advances frame after one interval', () => {
    const clock = createStopMotionClock(8) // 125ms intervals
    clock.tick(0)
    expect(clock.tick(0.125)).toBe(1)
  })

  it('advances multiple frames for large time jump', () => {
    const clock = createStopMotionClock(8)
    clock.tick(0)
    expect(clock.tick(1.0)).toBe(8)
  })

  it('reset returns to frame 0', () => {
    const clock = createStopMotionClock(8)
    clock.tick(0)
    clock.tick(1.0)
    clock.reset()
    expect(clock.tick(0)).toBe(0)
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

```bash
npm test
```
Expected: FAIL — `Cannot find module './stopMotion'`

- [ ] **Step 6: Implement StopMotionClock**

```ts
// src/lib/illustrated/stopMotion.ts
export interface StopMotionClock {
  tick(realTime: number): number
  reset(): void
}

export function createStopMotionClock(fps: number): StopMotionClock {
  const interval = 1 / fps
  let lastTick = -1
  let frame = 0
  return {
    tick(t: number): number {
      if (lastTick < 0) {
        lastTick = t
        return frame
      }
      while (t >= lastTick + interval) {
        frame++
        lastTick += interval
      }
      return frame
    },
    reset() {
      lastTick = -1
      frame = 0
    }
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npm test
```
Expected: PASS — 4 tests

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/illustrated/stopMotion.ts src/lib/illustrated/stopMotion.test.ts
git commit -m "feat: add StopMotionClock + Vitest setup"
```

---

### Task 2: Sketch utilities

**Files:**
- Create: `src/lib/illustrated/sketch.ts`
- Create: `src/lib/illustrated/sketch.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  ```ts
  function seededRandom(seed: number): number  // returns [0, 1)
  function jitterLine(ctx, x0, y0, x1, y1, seed, amount): void
  function roughFill(ctx, points: [number, number][], fillColor, inkColor, seed): void
  function hatchShadow(ctx, x, y, w, h, seed, density?: number): void
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/illustrated/sketch.test.ts
import { describe, it, expect } from 'vitest'
import { seededRandom } from './sketch'

describe('seededRandom', () => {
  it('returns a value in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const v = seededRandom(i)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is deterministic — same seed gives same value', () => {
    expect(seededRandom(42)).toBe(seededRandom(42))
    expect(seededRandom(7)).toBe(seededRandom(7))
  })

  it('different seeds give different values', () => {
    expect(seededRandom(1)).not.toBe(seededRandom(2))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```
Expected: FAIL — `Cannot find module './sketch'`

- [ ] **Step 3: Implement sketch utilities**

```ts
// src/lib/illustrated/sketch.ts
export function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1.618) * 43758.5453
  return x - Math.floor(x)
}

export function jitterLine(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  x1: number, y1: number,
  seed: number,
  amount: number
): void {
  ctx.beginPath()
  ctx.moveTo(
    x0 + (seededRandom(seed) - 0.5) * amount,
    y0 + (seededRandom(seed + 0.3) - 0.5) * amount
  )
  ctx.lineTo(
    x1 + (seededRandom(seed + 0.6) - 0.5) * amount,
    y1 + (seededRandom(seed + 0.9) - 0.5) * amount
  )
  ctx.stroke()
}

export function roughFill(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  fillColor: string,
  inkColor: string,
  seed: number
): void {
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
  ctx.closePath()
  ctx.fillStyle = fillColor
  ctx.fill()

  ctx.strokeStyle = inkColor
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(
    points[0][0] + (seededRandom(seed) - 0.5) * 4,
    points[0][1] + (seededRandom(seed + 0.1) - 0.5) * 4
  )
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(
      points[i][0] + (seededRandom(seed + i) - 0.5) * 4,
      points[i][1] + (seededRandom(seed + i + 0.1) - 0.5) * 4
    )
  }
  ctx.closePath()
  ctx.stroke()
}

export function hatchShadow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  seed: number,
  density = 6
): void {
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1
  for (let i = 0; i < density; i++) {
    const t = (i + seededRandom(seed + i) * 0.5) / density
    const lx = x + t * w
    ctx.beginPath()
    ctx.moveTo(lx, y)
    ctx.lineTo(lx - h * 0.25, y + h)
    ctx.stroke()
  }
  ctx.restore()
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```
Expected: PASS — 7 tests total (4 from Task 1 + 3 new)

- [ ] **Step 5: Commit**

```bash
git add src/lib/illustrated/sketch.ts src/lib/illustrated/sketch.test.ts
git commit -m "feat: add sketch utilities (jitter, roughFill, hatchShadow)"
```

---

### Task 3: FrameState types + mode store + IllustratedStage scaffold + App toggle

**Files:**
- Create: `src/lib/illustrated/types.ts`
- Create: `src/lib/illustrated/store.ts`
- Create: `src/lib/illustrated/IllustratedStage.svelte`
- Modify: `src/App.svelte`

**Interfaces:**
- Consumes: nothing from prior tasks yet
- Produces:
  ```ts
  // types.ts
  interface FrameState { t: number; sceneId: string; canvasW: number; canvasH: number }
  // store.ts
  import { illustratedMode } from '$lib/illustrated/store'  // Writable<boolean>
  ```

- [ ] **Step 1: Create FrameState types**

```ts
// src/lib/illustrated/types.ts
export interface FrameState {
  t: number
  sceneId: string
  canvasW: number
  canvasH: number
}
```

- [ ] **Step 2: Create the mode store**

```ts
// src/lib/illustrated/store.ts
import { writable } from 'svelte/store'
export const illustratedMode = writable(false)
```

- [ ] **Step 3: Create IllustratedStage scaffold**

This renders a blank black canvas and logs each frame to confirm the loop runs.

```svelte
<!-- src/lib/illustrated/IllustratedStage.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { FrameState } from './types'

  export let sceneId: string
  export let canvasW = 0
  export let canvasH = 0

  let canvas: HTMLCanvasElement
  let rafId: number
  let startTime = -1

  function render(now: number) {
    if (startTime < 0) startTime = now
    const t = (now - startTime) / 1000
    const ctx = canvas.getContext('2d')!
    const state: FrameState = { t, sceneId, canvasW: canvas.width, canvasH: canvas.height }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#0a0518'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    rafId = requestAnimationFrame(render)
  }

  onMount(() => {
    rafId = requestAnimationFrame(render)
  })

  onDestroy(() => cancelAnimationFrame(rafId))
</script>

<canvas bind:this={canvas} width={canvasW} height={canvasH} style="display:block;width:100%;height:100%;" />
```

- [ ] **Step 4: Modify App.svelte to add the toggle and conditional IllustratedStage**

Open `src/App.svelte`. Make these changes:

At the top of the `<script>` block, add the import:
```ts
import IllustratedStage from './lib/illustrated/IllustratedStage.svelte'
import { illustratedMode } from './lib/illustrated/store'
```

After the `ThreeStage` line (line 38), add:
```svelte
<ThreeStage scene={selectedScene} character={selectedCharacter} {gradientOn} {moonOn}
  style={$illustratedMode ? 'display:none' : ''} />

<div style={$illustratedMode ? '' : 'display:none'} class="illustrated-wrap">
  <IllustratedStage sceneId={selectedSceneId} canvasW={window.innerWidth} canvasH={window.innerHeight} />
</div>
```

Inside the `{#if studioOpen}` block, after the gradient-toggle button, add:
```svelte
<button
  class="illustrated-toggle"
  class:active={$illustratedMode}
  on:click={() => illustratedMode.update(v => !v)}
>
  {$illustratedMode ? 'illustrated' : '3D'}
</button>
```

Add to the `<style>` block:
```css
.illustrated-wrap {
  position: fixed;
  inset: 0;
  z-index: 0;
}

.illustrated-toggle {
  margin-top: 12px;
  width: 100%;
  color: #a4c4b8;
  border-color: rgba(164, 196, 184, 0.42);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}

.illustrated-toggle.active {
  background: rgba(92, 140, 122, 0.14);
  border-color: rgba(154, 200, 184, 0.72);
  color: #c4e4d8;
  box-shadow: 0 0 10px rgba(100, 180, 150, 0.22);
}
```

Note: `ThreeStage` does not accept a `style` prop. Instead, wrap it:

The final markup around ThreeStage should be:
```svelte
<div style={$illustratedMode ? 'display:none' : ''}>
  <ThreeStage scene={selectedScene} character={selectedCharacter} {gradientOn} {moonOn} />
</div>

<div style={$illustratedMode ? '' : 'display:none'} class="illustrated-wrap">
  <IllustratedStage sceneId={selectedSceneId} canvasW={window.innerWidth} canvasH={window.innerHeight} />
</div>
```

- [ ] **Step 5: Manual visual test**

```bash
npm run dev
```

Open http://localhost:5173. Open the studio panel. Click the "3D" button. The 3D scene should disappear and be replaced by a dark canvas. Click again — 3D scene returns. Scene selector still works.

- [ ] **Step 6: Commit**

```bash
git add src/lib/illustrated/types.ts src/lib/illustrated/store.ts src/lib/illustrated/IllustratedStage.svelte src/App.svelte
git commit -m "feat: add illustrated mode toggle + IllustratedStage scaffold"
```

---

### Task 4: Perspective road

**Files:**
- Create: `src/lib/illustrated/layers/road.ts`

**Interfaces:**
- Consumes:
  ```ts
  import { createStopMotionClock } from '../stopMotion'
  import { roughFill, jitterLine, seededRandom } from '../sketch'
  import type { FrameState } from '../types'
  ```
- Produces:
  ```ts
  interface RoadLayer { draw(ctx: CanvasRenderingContext2D, state: FrameState): void }
  function createRoadLayer(): RoadLayer
  ```

- [ ] **Step 1: Create the road layer**

```ts
// src/lib/illustrated/layers/road.ts
import { createStopMotionClock } from '../stopMotion'
import { roughFill, jitterLine, seededRandom } from '../sketch'
import type { FrameState } from '../types'

export interface RoadLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

export function createRoadLayer(): RoadLayer {
  const clock = createStopMotionClock(8)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const frame = clock.tick(t)
      const seed = frame * 0.17

      // Vanishing point
      const vpX = W * 0.5
      const vpY = H * 0.42

      // Road edge width at bottom of canvas
      const roadHalfW = W * 0.46

      // Road shape: trapezoid from wide at bottom to a point at VP
      const roadPoints: [number, number][] = [
        [vpX - 2, vpY],
        [vpX + 2, vpY],
        [vpX + roadHalfW, H],
        [vpX - roadHalfW, H]
      ]
      roughFill(ctx, roadPoints, '#4a4840', '#1a1814', seed)

      // Ground / kerb areas (outside the road to the canvas edges)
      roughFill(ctx, [
        [0, vpY], [vpX - 2, vpY], [vpX - roadHalfW, H], [0, H]
      ], '#2d3820', '#1a2010', seed + 10)
      roughFill(ctx, [
        [vpX + 2, vpY], [W, vpY], [W, H], [vpX + roadHalfW, H]
      ], '#2d3820', '#1a2010', seed + 20)

      // Scrolling centre-line dashes
      // Perspective: dash spacing at horizon is tiny, at bottom is large
      const dashCount = 12
      const scrollOffset = (frame % (dashCount * 2)) / (dashCount * 2)

      ctx.strokeStyle = '#e8e4d0'
      ctx.lineWidth = 2
      ctx.setLineDash([])

      for (let i = 0; i < dashCount; i++) {
        // t is normalised [0,1] along road depth (0=horizon, 1=bottom)
        const tNorm = ((i + scrollOffset) / dashCount)
        if (tNorm <= 0 || tNorm > 1) continue

        // Perspective projection: positions converge toward VP
        const y = vpY + tNorm * (H - vpY)
        const perspScale = tNorm
        const dashW = 8 * perspScale
        const dashH = 18 * perspScale
        const dashSeed = seed + i * 3.7

        // Only draw every other dash (dashed line pattern)
        if (i % 2 === 0) {
          jitterLine(ctx, vpX - dashW, y - dashH, vpX - dashW, y, dashSeed, 2 * perspScale)
          jitterLine(ctx, vpX + dashW, y - dashH, vpX + dashW, y, dashSeed + 1, 2 * perspScale)
          jitterLine(ctx, vpX - dashW, y - dashH, vpX + dashW, y - dashH, dashSeed + 2, 2 * perspScale)
          jitterLine(ctx, vpX - dashW, y, vpX + dashW, y, dashSeed + 3, 2 * perspScale)
        }
      }
    }
  }
}
```

- [ ] **Step 2: Wire road into IllustratedStage**

Open `src/lib/illustrated/IllustratedStage.svelte`.

Add import at top of script:
```ts
import { createRoadLayer } from './layers/road'
const road = createRoadLayer()
```

Inside the `render` function, after clearing the canvas, add:
```ts
road.draw(ctx, state)
```

- [ ] **Step 3: Manual visual test**

With `npm run dev` running, toggle to illustrated mode. You should see a dark canvas with a perspective road converging to a centre vanishing point, centre-line dashes scrolling forward in discrete hops.

- [ ] **Step 4: Commit**

```bash
git add src/lib/illustrated/layers/road.ts src/lib/illustrated/IllustratedStage.svelte
git commit -m "feat: add perspective road layer with scrolling lane markings"
```

---

### Task 5: Character 2D

**Files:**
- Create: `src/lib/illustrated/layers/character2D.ts`

**Interfaces:**
- Consumes:
  ```ts
  import { createStopMotionClock } from '../stopMotion'
  import { roughFill, jitterLine, hatchShadow, seededRandom } from '../sketch'
  import type { FrameState } from '../types'
  ```
- Produces:
  ```ts
  interface Character2DLayer { draw(ctx: CanvasRenderingContext2D, state: FrameState): void }
  function createCharacter2D(): Character2DLayer
  ```

- [ ] **Step 1: Create the character layer**

The character is drawn back-to-front (painter's algorithm) at a fixed position: `cx = W * 0.5`, `cy = H * 0.78`. Scale `s = H * 0.22`. All measurements are in pixels computed from `s`.

Eight walk poses are defined as a lookup table. `poseIndex = clock.tick(t) % 8`.

```ts
// src/lib/illustrated/layers/character2D.ts
import { createStopMotionClock } from '../stopMotion'
import { roughFill, jitterLine, hatchShadow, seededRandom } from '../sketch'
import type { FrameState } from '../types'

const SKIN = '#96603c'
const HOODIE = '#111111'
const HOODIE_DARK = '#080808'
const DENIM = '#3b5a8f'
const DENIM_CUFF = '#6c8ec4'
const SNEAKER = '#161616'
const SNEAKER_CREAM = '#e7e0d0'
const SNEAKER_RED = '#c24a5a'
const INK = '#0d0618'
const CAP = '#f2f0e8'

// Pose table: 8 frames of a walk cycle seen from behind
// bob: vertical offset fraction of s (negative = down)
// sway: horizontal offset fraction of s
// legL/legR: thigh angle from vertical in radians (+ = forward/right)
// kneeL/kneeR: knee bend in radians (always >= 0)
// armL/armR: shoulder angle from vertical in radians (+ = forward)
interface WalkPose {
  bob: number; sway: number
  legL: number; kneeL: number
  legR: number; kneeR: number
  armL: number; armR: number
  headTilt: number
}

const POSES: WalkPose[] = [
  { bob: 0,     sway: 0,     legL:  0.35, kneeL: 0,    legR: -0.35, kneeR: 0.35, armL: -0.28, armR:  0.28, headTilt:  0.04 },
  { bob: -0.04, sway: 0.04,  legL:  0.20, kneeL: 0.20, legR: -0.20, kneeR: 0.10, armL: -0.18, armR:  0.18, headTilt:  0.02 },
  { bob: -0.08, sway: 0.08,  legL:  0,    kneeL: 0.30, legR:  0,    kneeR: 0,    armL:  0,    armR:  0,    headTilt:  0    },
  { bob: -0.04, sway: 0.04,  legL: -0.20, kneeL: 0.10, legR:  0.20, kneeR: 0.20, armL:  0.18, armR: -0.18, headTilt: -0.02 },
  { bob: 0,     sway: 0,     legL: -0.35, kneeL: 0.35, legR:  0.35, kneeR: 0,    armL:  0.28, armR: -0.28, headTilt: -0.04 },
  { bob: -0.04, sway: -0.04, legL: -0.20, kneeL: 0.10, legR:  0.20, kneeR: 0.20, armL:  0.18, armR: -0.18, headTilt: -0.02 },
  { bob: -0.08, sway: -0.08, legL:  0,    kneeL: 0,    legR:  0,    kneeR: 0.30, armL:  0,    armR:  0,    headTilt:  0    },
  { bob: -0.04, sway: -0.04, legL:  0.20, kneeL: 0.20, legR: -0.20, kneeR: 0.10, armL: -0.18, armR:  0.18, headTilt:  0.02 },
]

// Draw a rounded-rectangle limb. cx,cy = centre, w,h = dimensions, angle = rotation from vertical
function drawLimb(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, color: string, seed: number) {
  const points: [number, number][] = [
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ]
  roughFill(ctx, points, color, INK, seed)
}

// Draw a foot/sneaker shape
function drawFoot(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, facing: -1 | 1, seed: number) {
  const fw = s * 0.18
  const fh = s * 0.08
  const ox = facing * fw * 0.3 // offset toe direction
  // Sole
  roughFill(ctx, [
    [cx - fw / 2 + ox, cy - fh * 0.4],
    [cx + fw / 2 + ox, cy - fh * 0.4],
    [cx + fw * 0.55 + ox, cy + fh * 0.6],
    [cx - fw * 0.45 + ox, cy + fh * 0.6],
  ], SNEAKER, INK, seed)
  // Cream midsole stripe
  roughFill(ctx, [
    [cx - fw / 2 + ox + 1, cy - fh * 0.1],
    [cx + fw / 2 + ox - 1, cy - fh * 0.1],
    [cx + fw / 2 + ox - 1, cy + fh * 0.1],
    [cx - fw / 2 + ox + 1, cy + fh * 0.1],
  ], SNEAKER_CREAM, SNEAKER_CREAM, seed + 1)
  // Red swoosh
  roughFill(ctx, [
    [cx - fw * 0.1 + ox, cy - fh * 0.3],
    [cx + fw * 0.35 + ox, cy - fh * 0.4],
    [cx + fw * 0.4 + ox, cy],
    [cx - fw * 0.1 + ox, cy - fh * 0.1],
  ], SNEAKER_RED, SNEAKER_RED, seed + 2)
}

export interface Character2DLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

export function createCharacter2D(): Character2DLayer {
  const clock = createStopMotionClock(8)
  const noteClock = createStopMotionClock(7)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const frame = clock.tick(t)
      const noteFrame = noteClock.tick(t)
      const pose = POSES[frame % 8]
      const seed = frame * 13.7

      const s = H * 0.22
      const cx = W * 0.5 + pose.sway * s
      const cy = H * 0.78 + pose.bob * s

      // Skeleton key Y positions (from bottom of character up)
      const ankleY = cy
      const kneeBaseY = cy - s * 0.26
      const hipY = cy - s * 0.50
      const pelvisY = hipY
      const spineTopY = hipY - s * 0.36
      const shoulderY = spineTopY
      const neckY = spineTopY - s * 0.06
      const headY = neckY - s * 0.18

      const thighLen = s * 0.26
      const calfLen = s * 0.24
      const upperArmLen = s * 0.20
      const foreArmLen = s * 0.18

      const hipSpread = s * 0.10
      const shoulderSpread = s * 0.22

      // Helper: compute knee position from hip, thigh angle, and calf angle
      function legKneePos(hipX: number, hipY: number, thighAngle: number): [number, number] {
        return [hipX + Math.sin(thighAngle) * thighLen, hipY + Math.cos(thighAngle) * thighLen]
      }
      function legAnklePos(kneeX: number, kneeY: number, thighAngle: number, kneeBend: number): [number, number] {
        const totalAngle = thighAngle - kneeBend
        return [kneeX + Math.sin(totalAngle) * calfLen, kneeY + Math.cos(totalAngle) * calfLen]
      }

      const hipLX = cx - hipSpread + Math.sin(pose.legL) * s * 0.05
      const hipRX = cx + hipSpread + Math.sin(pose.legR) * s * 0.05

      const [kneeLX, kneeLY] = legKneePos(hipLX, hipY, pose.legL)
      const [kneeRX, kneeRY] = legKneePos(hipRX, hipY, pose.legR)
      const [ankleLX, ankleLY] = legAnklePos(kneeLX, kneeLY, pose.legL, pose.kneeL)
      const [ankleRX, ankleRY] = legAnklePos(kneeRX, kneeRY, pose.legR, pose.kneeR)

      const shoulderLX = cx - shoulderSpread
      const shoulderRX = cx + shoulderSpread

      function armElbowPos(shoulderX: number, angle: number): [number, number] {
        return [shoulderX + Math.sin(angle) * upperArmLen, shoulderY + Math.cos(angle) * upperArmLen]
      }
      function armHandPos(elbowX: number, elbowY: number, angle: number): [number, number] {
        return [elbowX + Math.sin(angle * 0.5) * foreArmLen, elbowY + Math.cos(angle * 0.5) * foreArmLen]
      }

      const [elbowLX, elbowLY] = armElbowPos(shoulderLX, pose.armL)
      const [elbowRX, elbowRY] = armElbowPos(shoulderRX, pose.armR)
      const [handLX, handLY] = armHandPos(elbowLX, elbowLY, pose.armL)
      const [handRX, handRY] = armHandPos(elbowRX, elbowRY, pose.armR)

      const w = s * 0.11  // limb width

      // ---- Draw back-to-front ----

      // Back leg (right leg when pose.legR angle puts it visually behind)
      const backIsRight = pose.legR < pose.legL
      if (backIsRight) {
        // Right leg behind
        drawLimb(ctx, (hipRX + kneeRX) / 2, (hipY + kneeRY) / 2, w * 1.1, thighLen, DENIM, seed + 100)
        drawLimb(ctx, (kneeRX + ankleRX) / 2, (kneeRY + ankleRY) / 2, w, calfLen, DENIM, seed + 101)
        drawFoot(ctx, ankleRX, ankleRY, s, 1, seed + 102)
      } else {
        drawLimb(ctx, (hipLX + kneeLX) / 2, (hipY + kneeLY) / 2, w * 1.1, thighLen, DENIM, seed + 110)
        drawLimb(ctx, (kneeLX + ankleLX) / 2, (kneeLY + ankleLY) / 2, w, calfLen, DENIM, seed + 111)
        drawFoot(ctx, ankleLX, ankleLY, s, -1, seed + 112)
      }

      // Shorts / pelvis
      roughFill(ctx, [
        [cx - s * 0.16, hipY - s * 0.02],
        [cx + s * 0.16, hipY - s * 0.02],
        [cx + s * 0.14, hipY + s * 0.14],
        [cx - s * 0.14, hipY + s * 0.14],
      ], DENIM, INK, seed + 200)

      // Torso (hoodie back)
      roughFill(ctx, [
        [cx - s * 0.18, spineTopY],
        [cx + s * 0.18, spineTopY],
        [cx + s * 0.16, pelvisY],
        [cx - s * 0.16, pelvisY],
      ], HOODIE, INK, seed + 210)
      hatchShadow(ctx, cx - s * 0.18, spineTopY, s * 0.06, spineTopY - pelvisY, seed + 211)

      // Back arm (left arm when it's behind the body)
      const backArmIsLeft = pose.armL > 0
      if (backArmIsLeft) {
        drawLimb(ctx, (shoulderLX + elbowLX) / 2, (shoulderY + elbowLY) / 2, w * 0.9, upperArmLen, HOODIE, seed + 300)
        drawLimb(ctx, (elbowLX + handLX) / 2, (elbowLY + handLY) / 2, w * 0.8, foreArmLen, HOODIE, seed + 301)
        roughFill(ctx, [
          [handLX - s * 0.06, handLY - s * 0.06],
          [handLX + s * 0.06, handLY - s * 0.06],
          [handLX + s * 0.06, handLY + s * 0.06],
          [handLX - s * 0.06, handLY + s * 0.06],
        ], SKIN, INK, seed + 302)
      } else {
        drawLimb(ctx, (shoulderRX + elbowRX) / 2, (shoulderY + elbowRY) / 2, w * 0.9, upperArmLen, HOODIE, seed + 310)
        drawLimb(ctx, (elbowRX + handRX) / 2, (elbowRY + handRY) / 2, w * 0.8, foreArmLen, HOODIE, seed + 311)
        roughFill(ctx, [
          [handRX - s * 0.06, handRY - s * 0.06],
          [handRX + s * 0.06, handRY - s * 0.06],
          [handRX + s * 0.06, handRY + s * 0.06],
          [handRX - s * 0.06, handRY + s * 0.06],
        ], SKIN, INK, seed + 312)
      }

      // Hood / head area
      // Hood dome
      roughFill(ctx, [
        [cx - s * 0.22, neckY],
        [cx + s * 0.22, neckY],
        [cx + s * 0.26, headY - s * 0.10],
        [cx, headY - s * 0.24],
        [cx - s * 0.26, headY - s * 0.10],
      ], HOODIE, INK, seed + 400)

      // Head
      ctx.beginPath()
      ctx.ellipse(
        cx + pose.headTilt * s * 0.04,
        headY,
        s * 0.14,
        s * 0.16,
        pose.headTilt * 0.1,
        0, Math.PI * 2
      )
      ctx.fillStyle = SKIN
      ctx.fill()
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.stroke()

      // Backward cap (brim points forward = downward in back view)
      roughFill(ctx, [
        [cx - s * 0.15, headY - s * 0.14],
        [cx + s * 0.15, headY - s * 0.14],
        [cx + s * 0.13, headY - s * 0.02],
        [cx - s * 0.13, headY - s * 0.02],
      ], CAP, INK, seed + 410)
      // Cap brim (front brim, faces away from camera = appears below the hat crown)
      roughFill(ctx, [
        [cx - s * 0.11, headY - s * 0.02],
        [cx + s * 0.11, headY - s * 0.02],
        [cx + s * 0.14, headY + s * 0.04],
        [cx - s * 0.14, headY + s * 0.04],
      ], CAP, INK, seed + 411)

      // Headphone band
      ctx.strokeStyle = '#222222'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(cx, headY - s * 0.06, s * 0.18, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
      // Ear cups
      for (const side of [-1, 1] as const) {
        roughFill(ctx, [
          [cx + side * s * 0.17, headY - s * 0.10],
          [cx + side * s * 0.21, headY - s * 0.10],
          [cx + side * s * 0.21, headY - s * 0.02],
          [cx + side * s * 0.17, headY - s * 0.02],
        ], '#222222', INK, seed + 420 + side)
      }

      // Front leg (on top)
      if (backIsRight) {
        drawLimb(ctx, (hipLX + kneeLX) / 2, (hipY + kneeLY) / 2, w * 1.1, thighLen, DENIM, seed + 500)
        drawLimb(ctx, (kneeLX + ankleLX) / 2, (kneeLY + ankleLY) / 2, w, calfLen, DENIM, seed + 501)
        drawFoot(ctx, ankleLX, ankleLY, s, -1, seed + 502)
      } else {
        drawLimb(ctx, (hipRX + kneeRX) / 2, (hipY + kneeRY) / 2, w * 1.1, thighLen, DENIM, seed + 510)
        drawLimb(ctx, (kneeRX + ankleRX) / 2, (kneeRY + ankleRY) / 2, w, calfLen, DENIM, seed + 511)
        drawFoot(ctx, ankleRX, ankleRY, s, 1, seed + 512)
      }

      // Front arm (on top)
      if (backArmIsLeft) {
        drawLimb(ctx, (shoulderRX + elbowRX) / 2, (shoulderY + elbowRY) / 2, w * 0.9, upperArmLen, HOODIE, seed + 600)
        drawLimb(ctx, (elbowRX + handRX) / 2, (elbowRY + handRY) / 2, w * 0.8, foreArmLen, HOODIE, seed + 601)
        roughFill(ctx, [
          [handRX - s * 0.06, handRY - s * 0.06],
          [handRX + s * 0.06, handRY - s * 0.06],
          [handRX + s * 0.06, handRY + s * 0.06],
          [handRX - s * 0.06, handRY + s * 0.06],
        ], SKIN, INK, seed + 602)
      } else {
        drawLimb(ctx, (shoulderLX + elbowLX) / 2, (shoulderY + elbowLY) / 2, w * 0.9, upperArmLen, HOODIE, seed + 610)
        drawLimb(ctx, (elbowLX + handLX) / 2, (elbowLY + handLY) / 2, w * 0.8, foreArmLen, HOODIE, seed + 611)
        roughFill(ctx, [
          [handLX - s * 0.06, handLY - s * 0.06],
          [handLX + s * 0.06, handLY - s * 0.06],
          [handLX + s * 0.06, handLY + s * 0.06],
          [handLX - s * 0.06, handLY + s * 0.06],
        ], SKIN, INK, seed + 612)
      }

      // Floating music notes
      const noteSymbols = ['♪', '♫']
      const noteHues = [0.86, 0.12, 0.72]
      ctx.font = `bold ${Math.round(s * 0.28)}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let i = 0; i < 3; i++) {
        const life = ((noteFrame * 0.07 + i / 3) % 1)
        const side = i % 2 === 0 ? -1 : 1
        const nx = cx + side * (s * 0.6 + life * s * 0.5 + Math.sin(t * 1.2 + i * 2) * s * 0.08)
        const ny = cy - s * 0.6 - life * s * 0.9
        const hue = noteHues[i % 3]
        ctx.globalAlpha = (1 - life) * 0.85
        ctx.strokeStyle = 'rgba(10,6,20,0.9)'
        ctx.lineWidth = 4
        ctx.strokeText(noteSymbols[i % 2], nx, ny)
        ctx.fillStyle = `hsl(${Math.round(hue * 360)}, 65%, 62%)`
        ctx.fillText(noteSymbols[i % 2], nx, ny)
        ctx.globalAlpha = 1
      }
    }
  }
}
```

- [ ] **Step 2: Wire character into IllustratedStage**

Open `src/lib/illustrated/IllustratedStage.svelte`.

Add import:
```ts
import { createCharacter2D } from './layers/character2D'
const character = createCharacter2D()
```

In the render function, after `road.draw(ctx, state)`, add:
```ts
character.draw(ctx, state)
```

- [ ] **Step 3: Manual visual test**

Toggle to illustrated mode. A chibi character should appear walking in place on the road in discrete 8fps poses. Hoodie, denim shorts, sneakers, backward cap, headphones, floating music notes should all be visible. The lines should jitter slightly each frame (boil effect).

- [ ] **Step 4: Commit**

```bash
git add src/lib/illustrated/layers/character2D.ts src/lib/illustrated/IllustratedStage.svelte
git commit -m "feat: add 2D illustrated character with stop-motion walk cycle"
```

---

### Task 6: Trippy 90s scene background

**Files:**
- Create: `src/lib/illustrated/layers/scenes/trippy90s2D.ts`

**Interfaces:**
- Consumes:
  ```ts
  import { createStopMotionClock } from '../../stopMotion'
  import { roughFill, jitterLine, seededRandom } from '../../sketch'
  import type { FrameState } from '../../types'
  ```
- Produces:
  ```ts
  interface SceneLayer { draw(ctx: CanvasRenderingContext2D, state: FrameState): void }
  function createTrippy90s2D(): SceneLayer
  ```

- [ ] **Step 1: Create the trippy 90s scene**

```ts
// src/lib/illustrated/layers/scenes/trippy90s2D.ts
import { createStopMotionClock } from '../../stopMotion'
import { roughFill, jitterLine, seededRandom } from '../../sketch'
import type { FrameState } from '../../types'

export interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

export function createTrippy90s2D(): SceneLayer {
  const sunClock = createStopMotionClock(10)
  const cloudClock = createStopMotionClock(5)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const sunFrame = sunClock.tick(t)
      const cloudFrame = cloudClock.tick(t)
      const vpY = H * 0.42

      // Sky gradient (orange at horizon → deep purple at top)
      const grad = ctx.createLinearGradient(0, 0, 0, vpY)
      grad.addColorStop(0, '#2a0a4a')
      grad.addColorStop(0.5, '#6a1a6a')
      grad.addColorStop(1, '#e06020')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, vpY)

      // Sun — large flat circle
      const sunX = W * 0.5
      const sunY = vpY * 0.62
      const sunR = Math.min(W, H) * 0.13
      ctx.beginPath()
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
      ctx.fillStyle = '#f5c040'
      ctx.fill()
      ctx.strokeStyle = '#e08020'
      ctx.lineWidth = 3
      ctx.stroke()

      // Radial lines: 16 spokes, rotate in discrete snapped steps
      const spokeAngle = (sunFrame % 32) * (Math.PI / 32)
      ctx.strokeStyle = 'rgba(245, 192, 64, 0.5)'
      ctx.lineWidth = 2
      for (let i = 0; i < 16; i++) {
        const angle = spokeAngle + (i / 16) * Math.PI * 2
        const seed = sunFrame * 0.3 + i
        const len = sunR * (1.4 + seededRandom(seed) * 0.4)
        jitterLine(ctx,
          sunX + Math.cos(angle) * sunR * 1.05,
          sunY + Math.sin(angle) * sunR * 1.05,
          sunX + Math.cos(angle) * len,
          sunY + Math.sin(angle) * len,
          seed, 3
        )
      }

      // Building silhouettes — two layers
      const buildingDefs = [
        // [xFraction, widthFraction, heightFraction]
        { x: 0.02, w: 0.10, h: 0.55 },
        { x: 0.11, w: 0.07, h: 0.70 },
        { x: 0.17, w: 0.09, h: 0.60 },
        { x: 0.25, w: 0.06, h: 0.80 },
        { x: 0.30, w: 0.08, h: 0.65 },
        { x: 0.62, w: 0.08, h: 0.65 },
        { x: 0.69, w: 0.06, h: 0.80 },
        { x: 0.74, w: 0.09, h: 0.60 },
        { x: 0.82, w: 0.07, h: 0.70 },
        { x: 0.88, w: 0.10, h: 0.55 },
      ]

      // Back layer (darker, shorter)
      for (const b of buildingDefs) {
        const bx = W * b.x
        const bw = W * b.w
        const bh = vpY * b.h * 0.7
        roughFill(ctx, [
          [bx, vpY], [bx + bw, vpY],
          [bx + bw, vpY - bh], [bx, vpY - bh]
        ], '#1a0830', '#0d0420', 42 + b.x * 100)
      }

      // Front layer (more saturated purple silhouettes)
      for (const b of buildingDefs) {
        const bx = W * b.x - W * 0.02
        const bw = W * b.w * 0.8
        const bh = vpY * b.h
        roughFill(ctx, [
          [bx, vpY], [bx + bw, vpY],
          [bx + bw, vpY - bh], [bx, vpY - bh]
        ], '#2d0d50', '#1a0530', 77 + b.x * 100)
      }

      // Clouds: 4 blob shapes drifting right in discrete hops
      const cloudPositions = [0.08, 0.28, 0.55, 0.78]
      for (let i = 0; i < 4; i++) {
        const hop = (cloudFrame * 0.8 + i * W * 0.25) % W
        const cx = (cloudPositions[i] * W + hop) % W
        const cy = vpY * (0.22 + i * 0.12)
        const cr = W * (0.04 + i * 0.01)
        ctx.globalAlpha = 0.55
        ctx.fillStyle = '#7a3a8a'
        ctx.beginPath()
        ctx.ellipse(cx, cy, cr * 1.6, cr * 0.7, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.ellipse(cx - cr * 0.5, cy + cr * 0.2, cr, cr * 0.6, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.ellipse(cx + cr * 0.5, cy + cr * 0.2, cr * 1.1, cr * 0.65, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }
  }
}
```

- [ ] **Step 2: Wire into IllustratedStage**

Open `src/lib/illustrated/IllustratedStage.svelte`.

Add imports:
```ts
import { createTrippy90s2D } from './layers/scenes/trippy90s2D'
```

Add after the other layer instantiations:
```ts
const sceneMap: Record<string, { draw(ctx: CanvasRenderingContext2D, state: FrameState): void }> = {
  'trippy-90s': createTrippy90s2D(),
}
```

In the `render` function, replace the `ctx.fillRect` background clear with:
```ts
const scene = sceneMap[state.sceneId]
if (scene) scene.draw(ctx, state)
else {
  ctx.fillStyle = '#0a0518'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}
road.draw(ctx, state)
character.draw(ctx, state)
```

- [ ] **Step 3: Manual visual test**

Select "Trippy 90s City Road" scene and toggle to illustrated mode. You should see: purple-to-orange gradient sky, a large yellow sun with rotating spoke lines, layered dark building silhouettes, purple blob clouds drifting right in discrete hops, the perspective road, and the animated character.

- [ ] **Step 4: Commit**

```bash
git add src/lib/illustrated/layers/scenes/trippy90s2D.ts src/lib/illustrated/IllustratedStage.svelte
git commit -m "feat: add illustrated Trippy 90s scene background"
```

---

### Task 7: Jungle scene background

**Files:**
- Create: `src/lib/illustrated/layers/scenes/jungle2D.ts`

**Interfaces:**
- Consumes:
  ```ts
  import { createStopMotionClock } from '../../stopMotion'
  import { roughFill, seededRandom } from '../../sketch'
  import type { FrameState } from '../../types'
  ```
- Produces:
  ```ts
  // same SceneLayer interface as trippy90s2D.ts
  function createJungle2D(): SceneLayer
  ```

- [ ] **Step 1: Create the jungle scene**

```ts
// src/lib/illustrated/layers/scenes/jungle2D.ts
import { createStopMotionClock } from '../../stopMotion'
import { roughFill, seededRandom } from '../../sketch'
import type { FrameState } from '../../types'

export interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

export function createJungle2D(): SceneLayer {
  const canopyClock = createStopMotionClock(5)
  const lightClock = createStopMotionClock(6)
  const fireflyClock = createStopMotionClock(4)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const canopyFrame = canopyClock.tick(t)
      const lightFrame = lightClock.tick(t)
      const fireflyFrame = fireflyClock.tick(t)
      const vpY = H * 0.42

      // Sky: warm amber
      const grad = ctx.createLinearGradient(0, 0, 0, vpY)
      grad.addColorStop(0, '#3a1800')
      grad.addColorStop(0.6, '#c05010')
      grad.addColorStop(1, '#e08030')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, vpY)

      // Background tree silhouettes (3 layers, each sways at canopy clock)
      const layers = [
        { color: '#0a1a04', count: 6, minH: 0.55, maxH: 0.75, spread: 0.18 },
        { color: '#122208', count: 8, minH: 0.65, maxH: 0.88, spread: 0.14 },
        { color: '#1a3010', count: 10, minH: 0.72, maxH: 0.95, spread: 0.12 },
      ]

      for (let li = 0; li < layers.length; li++) {
        const layer = layers[li]
        const sway = (canopyFrame % 4 < 2 ? 1 : -1) * W * layer.spread * 0.012

        for (let i = 0; i < layer.count; i++) {
          const seed = li * 100 + i * 7.3
          const tx = (seededRandom(seed) * 1.1 - 0.05) * W
          const th = (layer.minH + seededRandom(seed + 1) * (layer.maxH - layer.minH)) * vpY
          const tw = W * (0.06 + seededRandom(seed + 2) * 0.06)

          // Trunk
          roughFill(ctx, [
            [tx - tw * 0.08, vpY],
            [tx + tw * 0.08, vpY],
            [tx + tw * 0.06 + sway, vpY - th * 0.5],
            [tx - tw * 0.06 + sway, vpY - th * 0.5],
          ], layer.color, layer.color, seed + 10)

          // Canopy blob (shifts with sway)
          ctx.beginPath()
          ctx.ellipse(tx + sway, vpY - th, tw * 0.8, th * 0.45, 0, 0, Math.PI * 2)
          ctx.fillStyle = layer.color
          ctx.fill()
        }
      }

      // Dappled light patches on road area
      ctx.globalAlpha = 0.12
      ctx.fillStyle = '#ffcc44'
      for (let i = 0; i < 8; i++) {
        const seed = lightFrame * 11.3 + i * 5.7
        const lx = W * (0.15 + seededRandom(seed) * 0.7)
        const ly = vpY + (seededRandom(seed + 1) * 0.6 + 0.1) * (H - vpY)
        const lw = W * (0.02 + seededRandom(seed + 2) * 0.04)
        ctx.beginPath()
        ctx.ellipse(lx, ly, lw, lw * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // Fireflies: small bright dots blinking on/off
      for (let i = 0; i < 12; i++) {
        const seed = i * 13.1
        const fx = W * (0.05 + seededRandom(seed) * 0.9)
        const fy = vpY * (0.1 + seededRandom(seed + 1) * 0.85)
        const on = Math.floor(seededRandom(seed + fireflyFrame * 0.7) * 3) !== 0
        if (on) {
          ctx.beginPath()
          ctx.arc(fx, fy, 2, 0, Math.PI * 2)
          ctx.fillStyle = '#aaff88'
          ctx.globalAlpha = 0.7 + seededRandom(seed + fireflyFrame) * 0.3
          ctx.fill()
          ctx.globalAlpha = 0.15
          ctx.arc(fx, fy, 6, 0, Math.PI * 2)
          ctx.fillStyle = '#88ff66'
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }
    }
  }
}
```

- [ ] **Step 2: Add jungle to sceneMap in IllustratedStage**

Open `src/lib/illustrated/IllustratedStage.svelte`. Add import:
```ts
import { createJungle2D } from './layers/scenes/jungle2D'
```

Add to `sceneMap`:
```ts
'jungle': createJungle2D(),
```

- [ ] **Step 3: Manual visual test**

Select "Jungle Trail" scene and toggle to illustrated mode. You should see: amber sky, layered tree silhouettes with canopy sway in discrete steps, dappled light patches on the road, blinking fireflies in the canopy, and the character walking.

- [ ] **Step 4: Commit**

```bash
git add src/lib/illustrated/layers/scenes/jungle2D.ts src/lib/illustrated/IllustratedStage.svelte
git commit -m "feat: add illustrated Jungle scene background"
```

---

### Task 8: Metropolis scene background

**Files:**
- Create: `src/lib/illustrated/layers/scenes/metropolis2D.ts`

**Interfaces:**
- Consumes:
  ```ts
  import { createStopMotionClock } from '../../stopMotion'
  import { roughFill, seededRandom } from '../../sketch'
  import type { FrameState } from '../../types'
  ```
- Produces:
  ```ts
  function createMetropolis2D(): SceneLayer  // same SceneLayer interface
  ```

- [ ] **Step 1: Create the metropolis scene**

```ts
// src/lib/illustrated/layers/scenes/metropolis2D.ts
import { createStopMotionClock } from '../../stopMotion'
import { roughFill, seededRandom } from '../../sketch'
import type { FrameState } from '../../types'

export interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

export function createMetropolis2D(): SceneLayer {
  const smogClock = createStopMotionClock(4)
  const billboardClock = createStopMotionClock(12)
  const neonClock = createStopMotionClock(12)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const smogFrame = smogClock.tick(t)
      const billboardFrame = billboardClock.tick(t)
      const neonFrame = neonClock.tick(t)
      const vpY = H * 0.42

      // Sky: dark blue-grey city haze
      const grad = ctx.createLinearGradient(0, 0, 0, vpY)
      grad.addColorStop(0, '#0a1428')
      grad.addColorStop(0.6, '#1a2a4a')
      grad.addColorStop(1, '#2a3a5a')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, vpY)

      // Building silhouettes
      const buildingDefs = [
        { x: 0.00, w: 0.09, h: 0.60 },
        { x: 0.08, w: 0.06, h: 0.85 },
        { x: 0.13, w: 0.10, h: 0.72 },
        { x: 0.22, w: 0.05, h: 0.95 },
        { x: 0.26, w: 0.08, h: 0.78 },
        { x: 0.34, w: 0.05, h: 0.62 },
        { x: 0.62, w: 0.05, h: 0.62 },
        { x: 0.66, w: 0.08, h: 0.78 },
        { x: 0.73, w: 0.05, h: 0.95 },
        { x: 0.77, w: 0.10, h: 0.72 },
        { x: 0.86, w: 0.06, h: 0.85 },
        { x: 0.91, w: 0.09, h: 0.60 },
      ]

      // Back layer
      for (const b of buildingDefs) {
        const bx = W * b.x
        const bw = W * b.w
        const bh = vpY * b.h * 0.85
        roughFill(ctx, [
          [bx, vpY], [bx + bw, vpY],
          [bx + bw, vpY - bh], [bx, vpY - bh]
        ], '#0e1c36', '#06101e', 31 + b.x * 100)
      }

      // Front layer
      for (const b of buildingDefs) {
        const bx = W * b.x + W * 0.015
        const bw = W * b.w * 0.75
        const bh = vpY * b.h
        roughFill(ctx, [
          [bx, vpY], [bx + bw, vpY],
          [bx + bw, vpY - bh], [bx, vpY - bh]
        ], '#182840', '#0a1828', 67 + b.x * 100)
      }

      // Billboard rectangles: flicker between two colour states
      const billboardDefs = [
        { x: 0.10, y: 0.38, w: 0.07, h: 0.12, hue1: 0.05, hue2: 0.58 },
        { x: 0.24, y: 0.20, w: 0.06, h: 0.10, hue1: 0.92, hue2: 0.14 },
        { x: 0.68, y: 0.25, w: 0.06, h: 0.10, hue1: 0.56, hue2: 0.05 },
        { x: 0.78, y: 0.35, w: 0.07, h: 0.12, hue1: 0.14, hue2: 0.92 },
      ]

      for (let i = 0; i < billboardDefs.length; i++) {
        const b = billboardDefs[i]
        const active = Math.floor(seededRandom(i * 3.7 + billboardFrame * 0.4) * 3) !== 0
        const hue = active ? b.hue1 : b.hue2
        const bx = W * b.x
        const by = vpY * b.y
        const bw = W * b.w
        const bh = vpY * b.h
        roughFill(ctx, [
          [bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]
        ], `hsl(${Math.round(hue * 360)}, 80%, 40%)`, '#000', i * 5.1)
      }

      // Neon glow blocks cycling hue
      const neonDefs = [
        { x: 0.08, y: 0.72, w: 0.035, h: 0.055 },
        { x: 0.25, y: 0.50, w: 0.030, h: 0.045 },
        { x: 0.67, y: 0.52, w: 0.030, h: 0.045 },
        { x: 0.83, y: 0.68, w: 0.035, h: 0.055 },
      ]

      for (let i = 0; i < neonDefs.length; i++) {
        const n = neonDefs[i]
        const hue = (seededRandom(i * 2.3 + neonFrame * 0.08) * 360)
        const nx = W * n.x
        const ny = vpY * n.y
        const nw = W * n.w
        const nh = vpY * n.h
        ctx.globalAlpha = 0.9
        ctx.fillStyle = `hsl(${Math.round(hue)}, 100%, 55%)`
        ctx.fillRect(nx, ny, nw, nh)
        ctx.globalAlpha = 0.2
        ctx.fillStyle = `hsl(${Math.round(hue)}, 100%, 70%)`
        ctx.fillRect(nx - 4, ny - 4, nw + 8, nh + 8)
        ctx.globalAlpha = 1
      }

      // Smog layer: semi-transparent band shifting position in hops
      const smogOffset = (smogFrame % 6) * W * 0.04
      ctx.globalAlpha = 0.15
      ctx.fillStyle = '#88aacc'
      ctx.fillRect(-smogOffset, vpY * 0.88, W * 1.3, vpY * 0.10)
      ctx.globalAlpha = 0.10
      ctx.fillStyle = '#aabbdd'
      ctx.fillRect(-smogOffset * 0.5 + W * 0.1, vpY * 0.76, W * 1.2, vpY * 0.08)
      ctx.globalAlpha = 1
    }
  }
}
```

- [ ] **Step 2: Add metropolis to sceneMap in IllustratedStage**

Open `src/lib/illustrated/IllustratedStage.svelte`. Add import:
```ts
import { createMetropolis2D } from './layers/scenes/metropolis2D'
```

Add to `sceneMap`:
```ts
'metropolis': createMetropolis2D(),
```

- [ ] **Step 3: Manual visual test**

Select "MetroCity Avenue" scene and toggle to illustrated mode. You should see: dark blue-grey city sky, layered building silhouettes, coloured billboard rectangles flickering between two states at 12fps, neon glow blocks cycling hue, shifting smog bands, and the character walking on the road.

- [ ] **Step 4: Final cross-scene test**

Switch between all three scenes while in illustrated mode. Verify:
- Each scene has its own distinct background
- The road and character remain consistent across all scenes
- Switching back to 3D mode and returning to illustrated mode works correctly

- [ ] **Step 5: Commit**

```bash
git add src/lib/illustrated/layers/scenes/metropolis2D.ts src/lib/illustrated/IllustratedStage.svelte
git commit -m "feat: add illustrated Metropolis scene background"
```

---

## Self-Review

**Spec coverage:**
- [x] Toggleable mode (same project) — Task 3
- [x] Full Canvas 2D renderer — Tasks 3–8
- [x] Character drawn programmatically, hand-sketched — Task 5
- [x] Low-fps flipbook animation (~8fps) — Task 5 (StopMotionClock)
- [x] Background elements animate in stop-motion at independent rates — Tasks 1, 6, 7, 8
- [x] All three scenes get 2D versions — Tasks 6, 7, 8
- [x] Shared perspective road — Task 4
- [x] Concept design colour palette — all tasks
- [x] No external image assets — confirmed, pure Canvas 2D throughout

**No placeholders found.**

**Type consistency:**
- `FrameState` defined once in `types.ts`, imported everywhere — consistent
- `SceneLayer` interface (`draw(ctx, state)`) is re-declared in each scene file (no shared import needed, all identical) — consistent
- `StopMotionClock.tick()` return type `number` used directly as frame index everywhere — consistent
- `createRoadLayer`, `createCharacter2D`, `createTrippy90s2D`, `createJungle2D`, `createMetropolis2D` — all named consistently with their files
