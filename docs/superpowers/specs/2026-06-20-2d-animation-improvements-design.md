# 2D Animation Improvements — Design Spec
**Date:** 2026-06-20

## Problem

The 2D illustrated mode has three visible quality issues before ship:

1. **Long load times** — all 3 scenes × 8 webp frames = 24 background images are eager-loaded upfront, even for inactive scenes.
2. **Static backgrounds** — the 8 webp frames cycle so slowly (72s ÷ 8 = 9s/frame) that the background looks frozen. There's no sense of clouds moving, sun animating, or atmosphere breathing.
3. **Walk animation stutter** — PNG character frames 02, 06, and 07 all look like the character standing upright with feet together. At 5fps, three consecutive neutral frames makes the character appear to stop and restart every cycle.

---

## Solution Overview

**Option B (chosen):** Canvas animation overlay on top of existing webp flipbook.

- The webp frames provide the painted static background (sky, buildings, road).
- A transparent `<canvas>` overlay draws only animated atmospheric elements (clouds, fireflies, smog, sun stripes) each rAF tick.
- Non-active scenes lazy-load their webp frames, cutting initial fetches from 24 → 8.
- Character PNG frames 02, 06, 07 are replaced with correct walk-cycle poses.

---

## Architecture

### 1. Lazy Loading (load time fix)

In `IllustratedStage.svelte`, change webp `<img>` `loading` attribute:

```html
<!-- Before -->
loading="eager"

<!-- After -->
loading={id === currentSceneId ? 'eager' : 'lazy'}
```

Only the active scene's 8 frames load immediately. The other 16 load on demand (when the user switches scenes).

### 2. Canvas Overlay Layer

Add a `<canvas>` element to `IllustratedStage.svelte`:
- Position: `absolute`, `inset: 0`, `width: 100%`, `height: 100%`
- Z-index: 2 (above webp layer at z-index 1, below walker-glow at z-index 3)
- `pointer-events: none`

Run a `requestAnimationFrame` loop while `active=true`. Each tick:
1. `ctx.clearRect(0, 0, canvas.width, canvas.height)` (transparent reset)
2. Call `scene.drawOverlay(ctx, { t, sceneId: currentSceneId, canvasW, canvasH })`

Start the rAF when `active` becomes true; cancel it when `active` becomes false or component is destroyed.

### 3. SceneLayer Interface — `drawOverlay()` Method

Add an optional method to the `SceneLayer` interface. Note: this interface is **duplicated in each scene file** (not in a shared module) — add `drawOverlay` to all three definitions:

```ts
interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
  drawForeground?(ctx: CanvasRenderingContext2D, state: FrameState): void
  drawOverlay?(ctx: CanvasRenderingContext2D, state: FrameState): void  // NEW
}
```

Each scene implements `drawOverlay()` with **only animated atmospheric elements** — no sky fill, no building corridor. The corridor and static sky remain in the webp frames.

### 4. Per-Scene Overlay Content

**`trippy90s2D.ts`**
- `drawClouds()` — already written, uses `cloudClock` to move clouds across sky. Call as-is.
- `drawAnimatedSunStripes()` — **new function**. Clips to the sun circle (centered at `W*0.5`, `vpY*0.68`, radius `min(W,H)*0.18`), then draws horizontal bands that slowly scroll downward over time using `t`. Bands use the same sky gradient colors as the webp (`lerpSkyColor`). Creates the classic retro pulsing sunset look.

**`jungle2D.ts`**
- `drawFireflies()` — already written, uses `fireflyClock`. Call as-is.
- `drawDappledLight()` — already written, uses `lightClock`. Call as-is.

**`metropolis2D.ts`**
- `drawSmog()` — already written, uses `smogClock`. Call as-is.

### 5. Scene Instantiation in IllustratedStage

`IllustratedStage.svelte` needs to instantiate the right scene object when `currentSceneId` changes:

```ts
import { createTrippy90s2D } from './layers/scenes/trippy90s2D'
import { createJungle2D }    from './layers/scenes/jungle2D'
import { createMetropolis2D } from './layers/scenes/metropolis2D'

const SCENE_FACTORIES = {
  'trippy-90s':  createTrippy90s2D,
  'jungle':      createJungle2D,
  'metropolis':  createMetropolis2D,
}

let overlayScene = SCENE_FACTORIES[currentSceneId]()

// Re-create on scene switch (resets stop-motion clocks)
$: if (mounted && currentSceneId) {
  overlayScene = SCENE_FACTORIES[normalizeSceneId(currentSceneId) as keyof typeof SCENE_FACTORIES]()
}
```

---

## Character Walk Cycle Fix

### Root Cause

The PNG frames were meant to follow the `POSES` table in `character2D.ts`, but three frames were drawn incorrectly as neutral/upright stances:

| Frame | Expected pose | Actual |
|-------|--------------|--------|
| 02 | Weight transfer to left — body dipping, left knee absorbing, right foot just lifted | Standing neutral |
| 06 | Weight transfer to right (mirror of 02) — body dipping, right knee absorbing | Standing neutral |
| 07 | Right leg passing — body at lowest dip, right knee visibly bent mid-swing | Standing neutral |

### New Frame Specifications

**Frame 02 — Left weight transfer:**
Body slightly below neutral (compression). Leaning slightly right. Left foot flat, left knee beginning to bend. Right foot just lifted, right knee slightly bent. Right arm slightly forward, left arm slightly back.

**Frame 06 — Right weight transfer (mirror of frame 02):**
Body slightly below neutral. Leaning slightly left. Right foot flat, right knee beginning to bend. Left foot just lifted, left knee slightly bent. Left arm slightly forward, right arm slightly back.

**Frame 07 — Right leg passing (lowest point):**
Body at its lowest dip, leaning clearly left. Both thighs centered (neither forward nor back). Right knee visibly bent — foot hanging mid-swing. Left leg straight, bearing weight. Arms mostly at sides. Head straight.

### AI Generation Prompt Prefix

> Anime/manga cel-shaded illustration. Young kid seen from slightly behind (3/4 rear view), walking away from viewer. Curly dark hair, backwards baseball cap (bill facing front), large navy/red over-ear headphones, oversized cream baseball jersey with "95" on back and red hem stripe, baggy denim shorts, white crew socks, red/white high-top sneakers. White background, clean bold ink linework, flat colors.

Append the specific pose description for each frame.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/illustrated/IllustratedStage.svelte` | Add canvas overlay, rAF loop, lazy loading, scene instantiation |
| `src/lib/illustrated/layers/scenes/trippy90s2D.ts` | Add `drawOverlay()` + `drawAnimatedSunStripes()` |
| `src/lib/illustrated/layers/scenes/jungle2D.ts` | Add `drawOverlay()` calling existing firefly/light functions |
| `src/lib/illustrated/layers/scenes/metropolis2D.ts` | Add `drawOverlay()` calling existing smog function |
| `src/lib/illustrated/assets/character/frame-02.png` | Replace with correct weight-transfer pose |
| `src/lib/illustrated/assets/character/frame-06.png` | Replace with correct weight-transfer pose (mirror) |
| `src/lib/illustrated/assets/character/frame-07.png` | Replace with correct passing pose |

No new webp background frames required. No changes to `sceneFrames.ts`.

---

## Success Criteria

- Initial page load fetches only 8 webp frames (active scene) instead of 24
- Clouds visibly drift across the trippy-90s sky
- Sun stripes scroll slowly downward on the retro sun
- Fireflies flicker in the jungle scene
- Smog bands drift in the metropolis scene
- Character walk cycle has no "standing still" frames — smooth 8-beat stride at 5fps
- No regressions on scene switching or the 3D mode
