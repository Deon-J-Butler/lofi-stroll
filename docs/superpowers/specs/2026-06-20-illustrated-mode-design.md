# Illustrated Mode — Design Spec

**Date:** 2026-06-20
**Status:** Approved

---

## Overview

Add a toggleable "illustrated mode" to the existing Lo-Fi Stroll app. When active, the Three.js renderer is hidden and replaced by a Canvas 2D renderer that draws every element — character, background, and scene dressing — in a hand-sketched, stop-motion style inspired by the original concept design and the rotoscoped animation aesthetic of A-ha's "Take On Me" video.

The existing 3D mode is preserved and remains the default. Neither renderer is destroyed on toggle, so switching is instant.

---

## Goals

- Visually match the original concept design: warm 90s palette, bold ink outlines, Ghibli-soft painted scenes, chibi character
- Animate the character as discrete key-poses that snap frame-to-frame (flipbook feel, ~8 fps)
- Background elements (clouds, sun, scene dressing) also animate in stop-motion at their own independent rates
- All three existing scenes (Trippy 90s, Jungle, Metropolis) get 2D illustrated versions
- All scenes share the same perspective road as their base
- Pure code — no external image assets required

---

## Non-Goals

- Does not replace the 3D mode
- Does not introduce external sprite sheets or image files
- Does not alter existing Three.js code paths

---

## Architecture

### Mode Toggle

A new Svelte store `illustratedMode: Writable<boolean>` (default `false`) in `src/lib/store.ts` controls which renderer is active. `App.svelte` renders both `ThreeStage` and `IllustratedStage` simultaneously but shows only the active one via CSS `display: none`. This ensures toggling back to 3D is instant with no reinitialisation cost.

A toggle button is added to the existing UI controls.

### New Directory Structure

```
src/lib/illustrated/
  IllustratedStage.svelte     — canvas element, render loop, scene dispatch
  stopMotion.ts               — StopMotionClock: discrete-frame timing per fps
  sketch.ts                   — jitter/ink drawing utilities (boil, rough fill, hatching)
  layers/
    road.ts                   — shared perspective road + scrolling lane markings
    character2D.ts            — hand-drawn character, pose table, per-frame sketch draw
    scenes/
      trippy90s2D.ts          — 90s sky, sun, radial lines, building silhouettes, clouds
      jungle2D.ts             — canopy silhouettes, dappled light, blinking fireflies
      metropolis2D.ts         — city skyline, smog layer, billboard flicker, neon glow
```

Each scene's background is a **pure function** `drawScene(ctx: CanvasRenderingContext2D, state: FrameState): void`. Stateless, no side effects, easy to iterate on independently.

---

## Stop-Motion Clock (`stopMotion.ts`)

```ts
interface StopMotionClock {
  tick(realTime: number): number  // returns discrete frame index
}
createStopMotionClock(fps: number): StopMotionClock
```

Each animated element holds its own clock. The render loop calls `tick(t)` per element; the returned integer is the only thing the element uses to determine its state. Elements never interpolate — they snap.

### Clock Rates

| Element | Rate |
|---|---|
| Character poses | 8 fps |
| Sun rotation lines | 10 fps |
| Clouds | 5 fps |
| Neon / billboard flicker | 12 fps |
| Fireflies | 4 fps |
| Music notes | 7 fps |
| Road lane scroll | 8 fps |

The desync between rates is intentional — it produces the independently-animated feel of traditional stop-motion.

---

## Sketch Utilities (`sketch.ts`)

Three primitive operations used throughout:

**`jitterLine(ctx, x0, y0, x1, y1, seed, amount)`** — draws a line with small random endpoint offsets, reseeded each frame tick so strokes visibly "boil."

**`roughFill(ctx, path, fillColor, inkColor, seed)`** — fills a path with flat color, then redraws the outline with per-vertex jitter and a slight ink offset.

**`hatchShadow(ctx, region, angle, density, seed)`** — adds cross-hatch strokes to the shadow side of a body region.

All randomness is seeded by `(frameIndex, salt)` so every frame tick produces a consistent-but-different drawing.

---

## Character (`character2D.ts`)

### Pose Table

Eight key walk poses defined as joint-angle tables:
`contactL`, `downL`, `passingL`, `upL`, `contactR`, `downR`, `passingR`, `upR`

Each pose is a plain object:
```ts
interface Pose2D {
  pelvisY: number       // vertical bob offset
  sway: number          // lateral sway
  hipL: number; hipR: number
  kneeL: number; kneeR: number
  ankleL: number; ankleR: number
  shoulderL: number; shoulderR: number
  elbowL: number; elbowR: number
  headNod: number; headYaw: number
}
```

Pose selection: `poseIndex = characterClock.tick(t) % 8`. No interpolation between poses.

### Drawing

Character is drawn back-to-front (back leg → torso → front leg → arms → head) using Canvas 2D primitives. Limbs are capsule-like rounded rectangles. Outlines use `jitterLine`. Fills use `roughFill`. Shadow sides get `hatchShadow`.

Palette matches the concept design:
- Skin: `#96603c`
- Hoodie: `#111111`
- Denim: `#3b5a8f`
- Sneakers: `#161616` with cream `#e7e0d0` and red `#c24a5a` accents
- Cap: white with backwards brim

The cap logo ("LO-FI"), headphone band, and music notes float independently at their own clock rates.

---

## Road Layer (`road.ts`)

All scenes render the road first, before their scene-specific layers.

- **Vanishing point**: fixed at horizontal centre, ~40% down the canvas
- **Road edges**: two perspective lines from bottom-left and bottom-right converging at the VP
- **Lane markings**: dashed centre line, positions computed from perspective projection, scrolling in discrete hops each `roadClock.tick(t)` frame to imply forward motion
- **Ground**: flat fill below the horizon, road colour above the kerb lines

The road is drawn with `roughFill` so its edges have the hand-drawn ink look consistent with the character.

---

## Scene Backgrounds

### Trippy 90s (`trippy90s2D.ts`)

- Sky: vertical gradient, orange at horizon → deep purple at top
- Sun: large flat circle, warm yellow, fixed at vanishing point
- Radial lines: 16 spokes rotating in snapped angular steps (`sunClock`)
- Building silhouettes: 2–3 layers of flat dark shapes, bold outlines
- Clouds: 3–4 irregular blob shapes drifting right in discrete hops (`cloudClock`)
- Foreground road feeds through from `road.ts`

### Jungle (`jungle2D.ts`)

- Sky: warm amber gradient
- Background trees: layered dark silhouettes, staggered depth
- Canopy sway: top edges of trees shift lateral position in discrete steps (`canopyClock`)
- Dappled light: semi-transparent patches on the road surface, positions snap each frame
- Fireflies: small bright dots that blink on/off at `fireflyClock` rate, scattered off-road

### Metropolis (`metropolis2D.ts`)

- Sky: dark blue-grey gradient, city haze
- Skyline: flat building silhouettes, varied heights, bold outlines
- Smog layer: semi-transparent horizontal band that shifts position in hops (`smogClock`)
- Billboards: rectangular shapes that flicker between two colour states (`billboardClock`)
- Neon glow: small coloured rectangles cycling hue at `neonClock`

---

## Render Loop (`IllustratedStage.svelte`)

```
requestAnimationFrame loop:
  1. Clear canvas
  2. drawScene(ctx, frameState)        — scene-specific background
  3. road.draw(ctx, frameState)        — shared perspective road
  4. character2D.draw(ctx, frameState) — character
  5. drawNotes(ctx, frameState)        — floating music notes
```

`frameState` is assembled once per frame:
```ts
interface FrameState {
  t: number           // real elapsed time (seconds)
  sceneId: string     // active scene key
  characterId: string // active character key
  canvasW: number
  canvasH: number
}
```

The Canvas 2D renderer runs at the browser's native 60fps; the stop-motion effect comes from *what gets drawn*, not from throttling `requestAnimationFrame`.

---

## UI Toggle

A button labelled **"3D / Illustrated"** (or an icon toggle) is added to the existing control bar in `App.svelte`. It flips `illustratedMode`. The button is visible in both modes so the user can always switch back.

---

## Out of Scope for This Spec

- Flying hero character in 2D mode (can be added as a follow-on)
- Audio reactivity changes
- Mobile-specific layout changes beyond what currently exists
