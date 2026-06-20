<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import {
    BACKGROUND_CYCLE_SECONDS,
    BACKGROUND_HOLD_ZOOM,
    BACKGROUND_TRANSITION_MS,
    CHARACTER_FPS,
    CHARACTER_FRAMES,
    CHARACTER_MOTION,
    getSceneBackgroundFrames,
    LIGHTING_MODES,
    normalizeSceneId,
    SCENE_IDS,
    type IllustratedLighting
  } from './sceneFrames'
  import { createTrippy90s2D } from './layers/scenes/trippy90s2D'
  import { createJungle2D } from './layers/scenes/jungle2D'
  import { createMetropolis2D } from './layers/scenes/metropolis2D'
  import type { FrameState } from './types'

  export let sceneId: string
  export let active = false
  export let night = false

  let mounted = false
  let currentSceneId = normalizeSceneId(sceneId)
  let currentLighting: IllustratedLighting = night ? 'night' : 'day'
  let characterFrameIndex = 0
  let backgroundFrameIndex = 0
  let characterTimer: ReturnType<typeof setInterval> | undefined
  let backgroundTimer: ReturnType<typeof setInterval> | undefined
  let characterFramesReady = false
  const readyVariantKeys = new Set<string>()
  let pendingVariantKey = `${currentSceneId}:${currentLighting}`
  let sceneLoadToken = 0

  const SCENE_FACTORIES = {
    'trippy-90s': createTrippy90s2D,
    'jungle': createJungle2D,
    'metropolis': createMetropolis2D,
  } as const

  let canvas: HTMLCanvasElement
  let rafId: number | undefined
  let rafStartTime = 0
  let overlayScene = SCENE_FACTORIES[normalizeSceneId(sceneId) as keyof typeof SCENE_FACTORIES]()

  $: normalizedSceneId = normalizeSceneId(sceneId)
  $: requestedLighting = night ? 'night' : 'day'
  $: activeBackgroundFrames = getSceneBackgroundFrames(
    currentSceneId,
    currentLighting
  )
  $: backgroundFrameMs =
    (BACKGROUND_CYCLE_SECONDS * 1000) / activeBackgroundFrames.length
  $: characterMotion =
    CHARACTER_MOTION[characterFrameIndex % CHARACTER_MOTION.length]

  function preloadSources(sources: readonly string[]): Promise<void> {
    return Promise.all(
      sources.map(
        (src) =>
          new Promise<void>((resolve) => {
            const image = new Image()
            image.onload = () => resolve()
            image.onerror = () => resolve()
            image.src = src
          })
      )
    ).then(() => undefined)
  }

  async function prepareCharacterFrames(): Promise<void> {
    await preloadSources(CHARACTER_FRAMES)
    characterFramesReady = true
  }

  function variantKey(
    sceneIdToLoad: string,
    lighting: IllustratedLighting
  ): string {
    return `${sceneIdToLoad}:${lighting}`
  }

  async function prepareVariant(
    sceneIdToLoad: string,
    lighting: IllustratedLighting
  ): Promise<void> {
    const key = variantKey(sceneIdToLoad, lighting)
    if (readyVariantKeys.has(key)) return
    await preloadSources(getSceneBackgroundFrames(sceneIdToLoad, lighting))
    readyVariantKeys.add(key)
  }

  async function activateVariant(
    nextSceneId: string,
    nextLighting: IllustratedLighting
  ): Promise<void> {
    const nextVariantKey = variantKey(nextSceneId, nextLighting)
    pendingVariantKey = nextVariantKey
    const loadToken = ++sceneLoadToken
    await prepareVariant(nextSceneId, nextLighting)
    if (
      loadToken !== sceneLoadToken ||
      pendingVariantKey !== nextVariantKey
    ) return

    currentSceneId = nextSceneId
    currentLighting = nextLighting
    backgroundFrameIndex = 0
    overlayScene =
      SCENE_FACTORIES[currentSceneId as keyof typeof SCENE_FACTORIES]()
    if (active) startAnimation()
  }

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

  function startAnimation() {
    stopAnimation()
    characterTimer = setInterval(() => {
      if (!characterFramesReady) return
      characterFrameIndex =
        (characterFrameIndex + 1) % CHARACTER_FRAMES.length
    }, 1000 / CHARACTER_FPS)
    backgroundTimer = setInterval(() => {
      if (
        !readyVariantKeys.has(variantKey(currentSceneId, currentLighting))
      ) return
      backgroundFrameIndex =
        (backgroundFrameIndex + 1) % activeBackgroundFrames.length
    }, backgroundFrameMs)
    // Start canvas overlay loop
    rafStartTime = 0
    rafId = requestAnimationFrame(tick)
  }

  function tick(now: number): void {
    if (!canvas) return
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
      lighting: currentLighting,
    }
    overlayScene.drawOverlay?.(ctx, state)
    rafId = requestAnimationFrame(tick)
  }

  $: if (
    mounted &&
    variantKey(normalizedSceneId, requestedLighting) !== pendingVariantKey
  ) {
    void activateVariant(normalizedSceneId, requestedLighting)
  }

  $: if (mounted) {
    if (active) startAnimation()
    else stopAnimation()
  }

  onMount(() => {
    mounted = true
    void prepareCharacterFrames()
    void prepareVariant(currentSceneId, currentLighting)
    if (active) startAnimation()
  })

  onDestroy(stopAnimation)
</script>

<div
  class="stop-motion-stage"
  role="img"
  aria-label="Hand-painted stop-motion scene of a character walking forward"
>
  {#each SCENE_IDS as id}
    {#each LIGHTING_MODES as lighting}
      <div
        class="scene-sequence"
        class:active={id === currentSceneId && lighting === currentLighting}
      >
        {#each getSceneBackgroundFrames(id, lighting) as src, index}
          <img
            class="scene-background"
            class:visible={index === backgroundFrameIndex}
            style={`--frame-duration:${backgroundFrameMs}ms;--hold-zoom:${BACKGROUND_HOLD_ZOOM};transition-duration:${BACKGROUND_TRANSITION_MS}ms`}
            {src}
            alt=""
            aria-hidden="true"
            loading={id === currentSceneId && lighting === currentLighting ? 'eager' : 'lazy'}
            fetchpriority={id === currentSceneId && lighting === currentLighting && index === 0 ? 'high' : 'auto'}
            decoding="async"
          />
        {/each}
      </div>
    {/each}
  {/each}

  <canvas
    bind:this={canvas}
    class="animation-overlay"
    aria-hidden="true"
  ></canvas>

  <div class="walker-glow" aria-hidden="true"></div>

  <div
    class="walker"
    style={`--walk-x:${characterMotion.x}%;--walk-y:${characterMotion.y}%;--walk-rotate:${characterMotion.rotate}deg`}
    aria-hidden="true"
  >
    <img
      class="walker-frame"
      src={CHARACTER_FRAMES[characterFrameIndex]}
      alt=""
      loading="eager"
      fetchpriority="high"
      decoding="sync"
    />
  </div>
</div>

<style>
  .stop-motion-stage,
  .scene-sequence,
  .scene-background,
  .walker,
  .walker-frame {
    position: absolute;
  }

  .stop-motion-stage,
  .scene-sequence,
  .scene-background {
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .stop-motion-stage {
    overflow: hidden;
    background: #090714;
  }

  .scene-sequence {
    opacity: 0;
    transition: opacity 500ms ease-out;
  }

  .scene-sequence.active {
    z-index: 1;
    opacity: 1;
  }

  .scene-background {
    z-index: 1;
    object-fit: cover;
    object-position: center;
    opacity: 0;
    transition-property: opacity;
    transition-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
    transform: scale(var(--hold-zoom));
    transform-origin: center 42%;
    user-select: none;
    pointer-events: none;
  }

  .scene-background.visible {
    z-index: 2;
    opacity: 1;
    animation:
      frame-forward var(--frame-duration)
      cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }

  .animation-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    pointer-events: none;
  }

  .walker {
    left: 50%;
    bottom: 0.5%;
    z-index: 4;
    width: auto;
    height: 58%;
    aspect-ratio: 1;
    transform:
      translateX(calc(-50% + var(--walk-x)))
      translateY(var(--walk-y))
      rotate(var(--walk-rotate));
    transition: transform 160ms ease-in-out;
    filter: drop-shadow(0 5px 4px rgba(10, 4, 12, 0.28));
  }

  .walker-frame {
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    pointer-events: none;
  }

  @keyframes frame-forward {
    from {
      transform: scale(1);
    }

    to {
      transform: scale(var(--hold-zoom));
    }
  }

  .walker-glow {
    position: absolute;
    left: 50%;
    bottom: 3.3%;
    z-index: 3;
    width: min(15vw, 180px);
    height: min(3vw, 36px);
    transform: translateX(-50%);
    border-radius: 50%;
    background: radial-gradient(
      ellipse,
      rgba(245, 176, 64, 0.36),
      rgba(245, 176, 64, 0) 72%
    );
    filter: blur(4px);
  }

  @media (max-width: 700px) {
    .walker {
      height: 52%;
    }

    .walker-glow {
      bottom: 2.5%;
      width: 28vw;
      height: 7vw;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scene-sequence,
    .scene-background {
      transition: none;
    }

    .scene-background.visible {
      animation: none;
    }
  }
</style>
