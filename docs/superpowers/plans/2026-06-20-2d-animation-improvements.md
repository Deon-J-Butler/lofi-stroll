# 2D Animation Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a transparent canvas animation overlay to the 2D illustrated stage so backgrounds breathe with movement (scrolling sun stripes, drifting clouds, blinking fireflies, drifting smog), and fix load time by lazy-loading non-active scene images.

**Architecture:** `IllustratedStage.svelte` is a webp flipbook (background) layered with a PNG flipbook (character). We add a transparent `<canvas>` between them that runs a `requestAnimationFrame` loop and calls `scene.drawOverlay()` each tick. Each of the three 2D scene files (`trippy90s2D.ts`, `jungle2D.ts`, `metropolis2D.ts`) gains a `drawOverlay()` method that draws only animated atmospheric effects — no sky fill, no buildings. Those stay in the webp. Non-active scenes switch their `<img>` tags to `loading="lazy"`, cutting initial fetches from 24 down to 8.

**Tech stack:** Svelte 5, TypeScript, Canvas 2D API, Vite, Vitest (`npm run test`)

## Global Constraints

- **No `git add` / `git commit`** — user runs `npm run dev` to verify before source controlling
- No new webp background frame files needed
- No changes to `sceneFrames.ts`
- Canvas overlay must be `pointer-events: none` (never blocks interaction)
- Canvas background must stay fully transparent — `clearRect` only, no fills — so the webp shows through
- Character PNG frames 02, 06, 07 are being replaced by the user externally; no code change needed for those

---

## Project Context

**What is lofi-stroll?**
A lofi music visualizer with a walking character. It has two display modes toggled via an `$illustratedMode` Svelte store:
- **3D mode** (`ThreeStage.svelte`): Three.js rendered scene
- **2D illustrated mode** (`IllustratedStage.svelte`): CSS flipbook of hand-painted `.webp` backgrounds + `.png` character walk-cycle frames

The 2D mode has three scenes: `trippy-90s` (retro sunset), `jungle` (dusk forest), `metropolis` (night city). Each scene has 8 webp background frames that cycle every 72 seconds, plus a shared 8-frame PNG character walk cycle.

**The canvas 2D scene files already exist** (`trippy90s2D.ts`, `jungle2D.ts`, `metropolis2D.ts`) and already contain fully-written animated drawing functions (clouds, fireflies, dappled light, smog). They are **not currently called** by `IllustratedStage.svelte` — that is what this plan wires up.

**Directory structure (relevant files only):**
```
src/lib/illustrated/
  IllustratedStage.svelte          ← main 2D display component     [MODIFY]
  types.ts                         ← FrameState interface           [read-only]
  stopMotion.ts                    ← createStopMotionClock factory  [read-only]
  sceneFrames.ts                   ← webp/PNG imports & constants   [read-only]
  layers/scenes/
    trippy90s2D.ts                 ← retro sunset scene             [MODIFY]
    jungle2D.ts                    ← jungle scene                   [MODIFY]
    metropolis2D.ts                ← metropolis scene               [MODIFY]
  assets/character/
    frame-01.png … frame-08.png    ← PNG walk cycle (user replaces 02, 06, 07)
  assets/background-frames/
    trippy-90s/frame-01.webp … frame-08.webp
    jungle/frame-01.webp … frame-08.webp
    metropolis/frame-01.webp … frame-08.webp
docs/superpowers/
  specs/2026-06-20-2d-animation-improvements-design.md  ← design spec
  plans/2026-06-20-2d-animation-improvements.md         ← this file
```

**Key types (read these files before editing — do not guess):**
```typescript
// types.ts
export interface FrameState {
  t: number        // elapsed seconds since animation started
  sceneId: string  // e.g. 'trippy-90s'
  canvasW: number
  canvasH: number
}

// stopMotion.ts
export interface StopMotionClock { tick(realTime: number): number; reset(): void }
export function createStopMotionClock(fps: number): StopMotionClock
```

**Critical: `SceneLayer` interface is duplicated per file.**
Each of the three scene files defines its own local `SceneLayer` interface (not imported from a shared module). When adding `drawOverlay?`, you must add it to the interface in **all three files**.

**Current `SceneLayer` interface (same in all three files):**
```typescript
export interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
  drawForeground?(ctx: CanvasRenderingContext2D, state: FrameState): void
}
```

**Existing animated helper functions (already written, do not rewrite):**

`jungle2D.ts` exports `createJungle2D()`. Inside it:
- `fireflyClock = createStopMotionClock(4)` — ticks firefly blink state
- `lightClock = createStopMotionClock(6)` — ticks dappled light positions
- `drawFireflies(ctx, W, vpY, fireflyFrame)` — 12 blinking green dots in side bands
- `drawDappledLight(ctx, W, H, vpY, lightFrame)` — 8 shifting golden ellipses on the road

`metropolis2D.ts` exports `createMetropolis2D()`. Inside it:
- `smogClock = createStopMotionClock(3)` — ticks smog scroll offset
- `drawSmog(ctx, W, vpY, smogFrame)` — 2 semi-transparent blue-grey bands drifting left

`trippy90s2D.ts` exports `createTrippy90s2D()`. Inside it:
- `cloudClock = createStopMotionClock(5)` — ticks cloud frame
- `drawClouds(ctx, W, vpY, cloudFrame)` — 4 purple ellipse clouds drifting right
- `drawStripedSun(ctx, sunX, sunY, sunR)` — draws static sun with 8 horizontal stripe bands
- `lerpSkyColor(y, topY, bottomY, stops)` — samples the sky gradient at a given Y position
- `SKY_STOPS` — array of `{ stop: number, color: string }` defining the sky gradient

**IllustratedStage.svelte z-index layer order (bottom to top):**
| Z-index | Element |
|---------|---------|
| 1 | `.scene-sequence.active` (webp backgrounds) |
| 2 | `.scene-background.visible` (active webp frame, inside sequence) |
| 3 | `.walker-glow` |
| 4 | `.walker` (PNG character) |

The canvas overlay goes at **z-index 2** as a sibling of `.scene-sequence` — above the webp container, below the glow.

**Test command:** `npm run test` (Vitest, no DOM environment by default — canvas tests use a stub context)

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/lib/illustrated/IllustratedStage.svelte` | Modify | `loading` attribute conditional; add `<canvas>`, rAF loop, scene imports + instantiation |
| `src/lib/illustrated/layers/scenes/jungle2D.ts` | Modify | Add `drawOverlay?` to `SceneLayer` interface; implement `drawOverlay` on returned object |
| `src/lib/illustrated/layers/scenes/metropolis2D.ts` | Modify | Same as jungle |
| `src/lib/illustrated/layers/scenes/trippy90s2D.ts` | Modify | Same + new `drawAnimatedSunStripes()` function |

---

## Task 1: Lazy-load non-active scene webp frames

**Files:**
- Modify: `src/lib/illustrated/IllustratedStage.svelte` (one attribute change)

**What this does:** Currently the template renders all 24 webp `<img>` tags with `loading="eager"`. Inactive scenes have `opacity: 0` in CSS but browsers still fetch them. Changing non-active scenes to `loading="lazy"` cuts initial network requests from 24 to 8.

- [ ] **Step 1: Open `src/lib/illustrated/IllustratedStage.svelte` and find the webp image loop**

It looks like this (around line 73):
```html
{#each SCENE_BACKGROUND_FRAMES[id] as src, index}
  <img
    class="scene-background"
    class:visible={index === backgroundFrameIndex}
    style:transition-duration={`${BACKGROUND_TRANSITION_MS}ms`}
    {src}
    alt=""
    aria-hidden="true"
    loading="eager"
    decoding="async"
  />
{/each}
```

- [ ] **Step 2: Replace the static `loading="eager"` with a reactive expression**

Change only the `loading` attribute:

```html
{#each SCENE_BACKGROUND_FRAMES[id] as src, index}
  <img
    class="scene-background"
    class:visible={index === backgroundFrameIndex}
    style:transition-duration={`${BACKGROUND_TRANSITION_MS}ms`}
    {src}
    alt=""
    aria-hidden="true"
    loading={id === currentSceneId ? 'eager' : 'lazy'}
    decoding="async"
  />
{/each}
```

`id` is the loop variable from `{#each SCENE_IDS as id}` and `currentSceneId` is already a `let` variable in the script block.

- [ ] **Step 3: Verify in browser**

Run `npm run dev`. Open DevTools → Network tab → filter by `img` or `webp`. Reload. You should see **8** webp requests on initial load (the active scene only), not 24. Switch scenes in the UI — the new scene's 8 frames should then load on demand.

---

## Task 2: Add `drawOverlay()` to jungle and metropolis scenes

**Files:**
- Modify: `src/lib/illustrated/layers/scenes/jungle2D.ts`
- Modify: `src/lib/illustrated/layers/scenes/metropolis2D.ts`
- Test: create `src/lib/illustrated/layers/scenes/sceneOverlay.test.ts`

**What this does:** Exposes the already-written animated drawing functions via a new `drawOverlay()` method on each scene's returned object. This is the method `IllustratedStage` will call from the canvas rAF loop.

- [ ] **Step 1: Write the failing tests first**

Create `src/lib/illustrated/layers/scenes/sceneOverlay.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createJungle2D } from './jungle2D'
import { createMetropolis2D } from './metropolis2D'

function makeCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(), restore: vi.fn(),
    fillRect: vi.fn(), fillStyle: '',
    globalAlpha: 1,
    beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(),
    fill: vi.fn(), clip: vi.fn(),
    strokeStyle: '', lineWidth: 0, stroke: vi.fn(),
    clearRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D
}

const baseState = { t: 0, sceneId: 'jungle', canvasW: 800, canvasH: 600 }

describe('jungle2D drawOverlay', () => {
  it('returns a scene with drawOverlay method', () => {
    const scene = createJungle2D()
    expect(typeof scene.drawOverlay).toBe('function')
  })

  it('drawOverlay runs without throwing at t=0', () => {
    const scene = createJungle2D()
    expect(() => scene.drawOverlay!(makeCtx(), baseState)).not.toThrow()
  })

  it('drawOverlay runs without throwing at t=10', () => {
    const scene = createJungle2D()
    expect(() => scene.drawOverlay!(makeCtx(), { ...baseState, t: 10 })).not.toThrow()
  })
})

describe('metropolis2D drawOverlay', () => {
  it('returns a scene with drawOverlay method', () => {
    const scene = createMetropolis2D()
    expect(typeof scene.drawOverlay).toBe('function')
  })

  it('drawOverlay runs without throwing at t=0', () => {
    const scene = createMetropolis2D()
    expect(() => scene.drawOverlay!(makeCtx(), { ...baseState, sceneId: 'metropolis' })).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests and confirm they fail**

```
npm run test
```

Expected: Tests fail with `TypeError: scene.drawOverlay is not a function`

- [ ] **Step 3: Update the `SceneLayer` interface in `jungle2D.ts`**

Find this interface at the top of `src/lib/illustrated/layers/scenes/jungle2D.ts`:

```typescript
export interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
  drawForeground?(ctx: CanvasRenderingContext2D, state: FrameState): void
}
```

Replace with:

```typescript
export interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
  drawForeground?(ctx: CanvasRenderingContext2D, state: FrameState): void
  drawOverlay?(ctx: CanvasRenderingContext2D, state: FrameState): void
}
```

- [ ] **Step 4: Add `drawOverlay` to the object returned by `createJungle2D()`**

Inside `createJungle2D()`, the `return { draw(...) {...}, drawForeground(...) {...} }` block gains a third method. Add it after `drawForeground`:

```typescript
drawOverlay(ctx: CanvasRenderingContext2D, state: FrameState) {
  const { t, canvasW: W, canvasH: H } = state
  const vpY = H * 0.4
  const fireflyFrame = fireflyClock.tick(t)
  const lightFrame = lightClock.tick(t)
  drawFireflies(ctx, W, vpY, fireflyFrame)
  drawDappledLight(ctx, W, H, vpY, lightFrame)
}
```

`fireflyClock` and `lightClock` are closure variables already created at the top of `createJungle2D()`. `drawFireflies` and `drawDappledLight` are standalone functions already defined in the same file. No imports needed.

- [ ] **Step 5: Update the `SceneLayer` interface in `metropolis2D.ts`**

Same change as Step 3, applied to `src/lib/illustrated/layers/scenes/metropolis2D.ts`.

- [ ] **Step 6: Add `drawOverlay` to the object returned by `createMetropolis2D()`**

```typescript
drawOverlay(ctx: CanvasRenderingContext2D, state: FrameState) {
  const { t, canvasW: W, canvasH: H } = state
  const vpY = H * 0.4
  const smogFrame = smogClock.tick(t)
  drawSmog(ctx, W, vpY, smogFrame)
}
```

`smogClock` is a closure variable in `createMetropolis2D()`. `drawSmog` is already defined in the same file.

- [ ] **Step 7: Run tests and confirm they pass**

```
npm run test
```

Expected: All 5 tests in `sceneOverlay.test.ts` pass.

---

## Task 3: Add `drawOverlay()` + animated sun stripes to trippy-90s scene

**Files:**
- Modify: `src/lib/illustrated/layers/scenes/trippy90s2D.ts`
- Test: add to `src/lib/illustrated/layers/scenes/sceneOverlay.test.ts`

**What this does:** The trippy-90s scene gets animated clouds (using existing `drawClouds`) plus a new `drawAnimatedSunStripes()` function. The animated stripes clip to the sun circle at the same position it appears in the webp (`W*0.5, vpY*0.68`, radius `min(W,H)*0.18`) and slowly scroll downward, creating the classic retro pulsing sunset look.

**How `drawAnimatedSunStripes` works:** It clips to the sun circle, then draws `stripeCount + 2` horizontal bands whose Y positions are offset by `(t * scrollSpeed * sunR) % stripeH`. As `t` advances, `scrollOffset` increases, making the bands appear to scroll downward. The band color comes from `lerpSkyColor()` (already in the file) so the animated stripes match the sky gradient used in the webp.

- [ ] **Step 1: Add tests for trippy-90s drawOverlay to `sceneOverlay.test.ts`**

Open `src/lib/illustrated/layers/scenes/sceneOverlay.test.ts` and add at the end:

```typescript
import { createTrippy90s2D } from './trippy90s2D'

describe('trippy90s2D drawOverlay', () => {
  it('returns a scene with drawOverlay method', () => {
    const scene = createTrippy90s2D()
    expect(typeof scene.drawOverlay).toBe('function')
  })

  it('drawOverlay runs without throwing at t=0', () => {
    const scene = createTrippy90s2D()
    expect(() =>
      scene.drawOverlay!(makeCtx(), { t: 0, sceneId: 'trippy-90s', canvasW: 800, canvasH: 600 })
    ).not.toThrow()
  })

  it('drawOverlay runs without throwing at t=30', () => {
    const scene = createTrippy90s2D()
    expect(() =>
      scene.drawOverlay!(makeCtx(), { t: 30, sceneId: 'trippy-90s', canvasW: 800, canvasH: 600 })
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests and confirm the new tests fail**

```
npm run test
```

Expected: 3 new trippy-90s tests fail with `TypeError: scene.drawOverlay is not a function`

- [ ] **Step 3: Update the `SceneLayer` interface in `trippy90s2D.ts`**

Same change as in Task 2 — add `drawOverlay?` to the local `SceneLayer` interface in `src/lib/illustrated/layers/scenes/trippy90s2D.ts`.

- [ ] **Step 4: Add `drawAnimatedSunStripes()` to `trippy90s2D.ts`**

Add this new function **after** `drawStripedSun` and **before** `drawClouds` in the file:

```typescript
function drawAnimatedSunStripes(
  ctx: CanvasRenderingContext2D,
  sunX: number,
  sunY: number,
  sunR: number,
  t: number
): void {
  ctx.save()

  // Clip to sun circle — same geometry as drawStripedSun
  ctx.beginPath()
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
  ctx.clip()

  // Scroll bands downward: one full stripe height per ~17 seconds
  const stripeCount = 8
  const stripeH = (sunR * 2) / stripeCount
  const scrollOffset = (t * sunR * 0.06) % stripeH

  // Draw stripeCount + 2 bands (extra above/below to avoid gaps at clip boundary)
  for (let i = -1; i <= stripeCount; i++) {
    const bandTop = sunY - sunR + i * stripeH + scrollOffset
    const bandMid = bandTop + stripeH * 0.19
    ctx.fillStyle = lerpSkyColor(bandMid, sunY - sunR, sunY + sunR, SKY_STOPS)
    ctx.fillRect(sunX - sunR - 2, bandTop, sunR * 2 + 4, stripeH * 0.38)
  }

  ctx.restore()
}
```

`lerpSkyColor` and `SKY_STOPS` are already defined above this point in the file. No imports needed.

- [ ] **Step 5: Add `drawOverlay` to the object returned by `createTrippy90s2D()`**

Inside `createTrippy90s2D()`, after `drawForeground`, add:

```typescript
drawOverlay(ctx: CanvasRenderingContext2D, state: FrameState) {
  const { t, canvasW: W, canvasH: H } = state
  const vpY = H * 0.4
  const cloudFrame = cloudClock.tick(t)
  const sunX = W * 0.5
  const sunY = vpY * 0.68
  const sunR = Math.min(W, H) * 0.18
  drawAnimatedSunStripes(ctx, sunX, sunY, sunR, t)
  drawClouds(ctx, W, vpY, cloudFrame)
}
```

`cloudClock` is a closure variable created at the top of `createTrippy90s2D()`. The sun geometry (`sunX`, `sunY`, `sunR`) matches exactly what `draw()` passes to `drawStripedSun()`, so the animated stripes align with the sun in the webp.

- [ ] **Step 6: Run tests and confirm all pass**

```
npm run test
```

Expected: All tests pass, including the 3 new trippy-90s tests.

---

## Task 4: Wire canvas overlay into `IllustratedStage`

**Files:**
- Modify: `src/lib/illustrated/IllustratedStage.svelte`

**What this does:** Adds a `<canvas>` element between the webp backgrounds and the walker. Runs a `requestAnimationFrame` loop while `active=true` that clears the canvas each tick and calls `overlayScene.drawOverlay()`. Re-creates the scene instance when the active scene changes (which resets the stop-motion clocks). Cancels the rAF loop when `active=false` or the component is destroyed.

**Dependencies:** Tasks 2 and 3 must be complete before this task.

- [ ] **Step 1: Add scene factory imports to the `<script>` block**

In `IllustratedStage.svelte`, the `<script>` block currently starts with:
```typescript
import { onDestroy, onMount } from 'svelte'
import { BACKGROUND_CYCLE_SECONDS, ... } from './sceneFrames'
```

Add these imports **after** the existing imports:
```typescript
import { createTrippy90s2D } from './layers/scenes/trippy90s2D'
import { createJungle2D } from './layers/scenes/jungle2D'
import { createMetropolis2D } from './layers/scenes/metropolis2D'
import type { FrameState } from './types'
```

- [ ] **Step 2: Add canvas state variables and scene factory map**

After the existing `let` declarations (the block ending with `let backgroundTimer`), add:

```typescript
const SCENE_FACTORIES = {
  'trippy-90s': createTrippy90s2D,
  'jungle': createJungle2D,
  'metropolis': createMetropolis2D,
} as const

let canvas: HTMLCanvasElement
let rafId: number | undefined
let rafStartTime = 0
let overlayScene = SCENE_FACTORIES[normalizeSceneId(sceneId) as keyof typeof SCENE_FACTORIES]()
```

`normalizeSceneId` is already imported from `./sceneFrames`. It returns the scene id or `'trippy-90s'` as a fallback.

- [ ] **Step 3: Add the rAF tick function**

Add this function **after** the `stopAnimation` function:

```typescript
function tick(now: number): void {
  if (!canvas) return

  // Resize backing store only when CSS dimensions change (avoids clearing every frame)
  if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
  }

  if (rafStartTime === 0) rafStartTime = now
  const t = (now - rafStartTime) / 1000

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const state: FrameState = {
    t,
    sceneId: currentSceneId,
    canvasW: canvas.width,
    canvasH: canvas.height,
  }

  overlayScene.drawOverlay?.(ctx, state)
  rafId = requestAnimationFrame(tick)
}
```

- [ ] **Step 4: Update `startAnimation` to launch the rAF loop**

The existing `startAnimation` function:
```typescript
function startAnimation() {
  stopAnimation()
  characterTimer = setInterval(...)
  backgroundTimer = setInterval(...)
}
```

Add two lines at the end:
```typescript
function startAnimation() {
  stopAnimation()
  characterTimer = setInterval(() => {
    characterFrameIndex = (characterFrameIndex + 1) % CHARACTER_FRAMES.length
  }, 1000 / CHARACTER_FPS)
  backgroundTimer = setInterval(() => {
    backgroundFrameIndex = (backgroundFrameIndex + 1) % activeBackgroundFrames.length
  }, backgroundFrameMs)
  // Start canvas overlay loop
  rafStartTime = 0
  rafId = requestAnimationFrame(tick)
}
```

- [ ] **Step 5: Update `stopAnimation` to cancel the rAF loop**

The existing `stopAnimation`:
```typescript
function stopAnimation() {
  if (characterTimer) clearInterval(characterTimer)
  if (backgroundTimer) clearInterval(backgroundTimer)
  characterTimer = undefined
  backgroundTimer = undefined
}
```

Add the rAF cancellation:
```typescript
function stopAnimation() {
  if (characterTimer) clearInterval(characterTimer)
  if (backgroundTimer) clearInterval(backgroundTimer)
  characterTimer = undefined
  backgroundTimer = undefined
  // Stop canvas overlay loop
  if (rafId !== undefined) {
    cancelAnimationFrame(rafId)
    rafId = undefined
  }
}
```

- [ ] **Step 6: Re-instantiate the overlay scene when the active scene changes**

Find the existing reactive block that handles scene switching:
```typescript
$: if (mounted && normalizedSceneId !== currentSceneId) {
  currentSceneId = normalizedSceneId
  backgroundFrameIndex = 0
  if (active) startAnimation()
}
```

Add the scene re-instantiation line (before `startAnimation`):
```typescript
$: if (mounted && normalizedSceneId !== currentSceneId) {
  currentSceneId = normalizedSceneId
  backgroundFrameIndex = 0
  overlayScene = SCENE_FACTORIES[currentSceneId as keyof typeof SCENE_FACTORIES]()
  if (active) startAnimation()
}
```

Re-creating the scene resets its stop-motion clocks to avoid frame-count drift when switching.

- [ ] **Step 7: Add the `<canvas>` element to the template**

In the template, the current structure is:
```html
<div class="stop-motion-stage" ...>
  {#each SCENE_IDS as id}         <!-- webp background loop -->
    <div class="scene-sequence" ...>
      ...
    </div>
  {/each}

  <div class="walker-glow" ...></div>
  <div class="walker" ...>...</div>
</div>
```

Insert the canvas **between** the closing `{/each}` and the `walker-glow` div:

```html
  {/each}

  <canvas
    bind:this={canvas}
    class="animation-overlay"
    aria-hidden="true"
  ></canvas>

  <div class="walker-glow" aria-hidden="true"></div>
```

- [ ] **Step 8: Add CSS for `.animation-overlay`**

In the `<style>` block, add after the existing `.scene-background.visible` rule:

```css
.animation-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}
```

Z-index 2 places the canvas above the webp sequence (z-index 1) and below the walker-glow (z-index 3).

- [ ] **Step 9: Verify all tests still pass**

```
npm run test
```

Expected: All tests pass (this task has no new unit tests — canvas/rAF integration is verified visually).

- [ ] **Step 10: Verify visually with `npm run dev`**

Switch to **2D mode** in the UI:

**Trippy-90s scene:**
- The sun's horizontal stripes slowly scroll downward
- Purple clouds drift from left to right across the sky
- Switching to 3D mode pauses the animation; returning to 2D resumes it

**Jungle scene:**
- Small green firefly dots blink on and off in the left and right side bands
- Faint golden ellipses slowly shift position on the road surface

**Metropolis scene:**
- Two semi-transparent blue-grey smog bands drift slowly across the upper portion of the background

**Scene switching:**
- Switching scenes transitions smoothly; the canvas overlay immediately shows the new scene's effects
- No console errors

---

## Character Walk Frames (user-supplied — no code change)

The user will provide replacement PNG files. When ready, drop them in:

| File | Pose |
|------|------|
| `src/lib/illustrated/assets/character/frame-02.png` | Left weight-transfer: body dipping, left knee absorbing, right foot just lifted |
| `src/lib/illustrated/assets/character/frame-06.png` | Right weight-transfer (mirror of 02): body dipping, right knee absorbing |
| `src/lib/illustrated/assets/character/frame-07.png` | Right leg passing: body at lowest dip, right knee bent mid-swing |

No code change needed — `sceneFrames.ts` imports frames by their existing filenames.

After dropping in the files: run `npm run dev` and observe the character. The 8-beat walk cycle should feel like a continuous, rhythmic stride — no pause or shuffle.

---

## Success Criteria

- [ ] Initial page load: DevTools Network shows 8 webp requests, not 24
- [ ] Scene switching triggers the new scene's frames to lazily load
- [ ] Trippy-90s: sun stripes scroll downward; clouds drift across sky
- [ ] Jungle: fireflies blink; dappled light patches shift on road
- [ ] Metropolis: smog bands drift across background
- [ ] Canvas animation pauses when switching to 3D mode; resumes on return to 2D
- [ ] Scene switching resets animation (no clock drift)
- [ ] `npm run test` — all tests pass
- [ ] `npm run build` — no TypeScript errors
- [ ] Character walk (after user provides new frames): no consecutive neutral-looking frames
