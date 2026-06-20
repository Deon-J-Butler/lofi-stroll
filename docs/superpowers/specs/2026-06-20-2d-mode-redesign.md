# 2D Mode Redesign — Design Spec

**Date:** 2026-06-20
**Status:** Approved
**Supersedes:** `2026-06-20-illustrated-mode-design.md` (that spec covered initial build; this covers the visual redesign)

> For full technical detail including code examples and colour palettes, see `DESIGN-2D-MODE.md` in the project root.

---

## Context

The first implementation of "Illustrated mode" (now renamed "2D mode") was built from a written spec but did not match the original concept design (`lo-fi_walk_concept_design.png`). The road and character are correct; the scene backgrounds are wrong.

The concept design shows:
- An urban street corridor — buildings flanking the road on both sides, tight and close, not distant background silhouettes
- A giant retro sun with horizontal stripe cuts (80s/90s synthwave aesthetic)
- Warm amber/orange window glow on buildings (not flat silhouettes)
- An "infinite forward walk" feeling — the environment scrolls past the viewer

The redesign keeps all existing infrastructure (StopMotionClock, sketch utilities, road layer, character) and replaces only the three scene background modules.

---

## Goals

- Match the concept design visually for the Trippy 90s scene (primary reference)
- All three scenes (Trippy 90s, Jungle, Metropolis) get their own corridor variant
- Create genuine "walking through" infinite scroll — buildings advance from the vanishing point toward the viewer in discrete stop-motion hops
- Rename the toggle button from "illustrated/3D" to "2D/3D"

## Non-Goals

- Does not change the road layer
- Does not change the character layer
- Does not change the 3D mode
- Does not introduce external image assets
- Does not change the Svelte store, types, or IllustratedStage orchestration

---

## Architecture

### New shared module

`src/lib/illustrated/layers/buildingCorridor.ts`

A parametric corridor renderer. Takes a `CorridorStyle` config (colours, building types, window layout) and returns a `CorridorLayer` with a single `draw(ctx, state)` method. Each scene module creates its own instance with its own config.

The corridor uses `SLAB_COUNT = 8` building slabs per side. Each slab has a `depth` value (0 = horizon, 1 = near viewer). A `StopMotionClock` at 8fps advances a shared `scrollProgress` counter each tick; the depth of each slab is `((i / SLAB_COUNT) + scrollProgress) % 1.0`. This creates a seamless infinite-loop corridor scroll.

Perspective projection:
- `vpX = W * 0.5`, `vpY = H * 0.40`
- Road half-width at depth d: `W * 0.42 * d`
- Facade width at depth d: `W * 0.26 * d`
- Ground Y at depth d: `vpY + (H - vpY) * d`
- Building top Y at depth d: `groundY - H * 0.70 * d`

### Scene module responsibility

Each scene module (`trippy90s2D.ts`, etc.) is responsible for:
1. Drawing its sky gradient
2. Drawing its special elements (sun, fireflies, smog...)
3. Calling its corridor instance's `draw()` method

The `IllustratedStage.svelte` render order stays the same: scene → road → character. The corridor is embedded inside the scene draw, not a separate top-level call.

---

## Scene Designs

### Trippy 90s
Palette: `#2a0854 → #7a1a7a → #e85020` sky. Sun at `(W*0.5, vpY*0.68)`, radius `min(W,H)*0.18`, with 7–8 horizontal stripe cuts through the bottom half. Building corridor: `#1a0840` walls, `#f0a820` lit windows, `#100828` dark windows. 3–4 blob clouds at 5fps.

### Jungle
Palette: `#3a1400 → #7a3000 → #e06020` sky. Tree corridor: `#0a1a04` dark tree shapes using same projection math as buildings; upper portion is a canopy blob, lower portion a narrow trunk. Firefly dots (10–12, 4fps blink) in the canopy zone. Dappled light ellipses on road (6fps).

### Metropolis
Palette: `#050810 → #0a1428` sky. Tower corridor: `#101820` walls, `#44aaff` lit windows, `#0a1018` dark windows. Neon sign rectangles on buildings cycling hue at 12fps. Smog band at 3fps.

---

## Button Rename

`src/App.svelte` line 87: change `'illustrated'` to `'2D'`.

No other changes to App.svelte, the store, or the component.
