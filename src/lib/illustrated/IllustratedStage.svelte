<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { FrameState } from './types'
  import { createRoadLayer } from './layers/road'
  import { createCharacter2D } from './layers/character2D'
  import { createTrippy90s2D } from './layers/scenes/trippy90s2D'
  import { createJungle2D } from './layers/scenes/jungle2D'
  import { createMetropolis2D } from './layers/scenes/metropolis2D'

  export let sceneId: string
  export let active = false

  const road = createRoadLayer()
  const character = createCharacter2D()
  const sceneMap: Record<string, { draw(ctx: CanvasRenderingContext2D, state: FrameState): void }> = {
    'trippy-90s': createTrippy90s2D(),
    'jungle': createJungle2D(),
    'metropolis': createMetropolis2D(),
  }

  let canvasW = window.innerWidth
  let canvasH = window.innerHeight
  let canvas: HTMLCanvasElement
  let rafId: number
  let startTime = -1

  function onResize() {
    canvasW = window.innerWidth
    canvasH = window.innerHeight
  }

  function render(now: number) {
    if (startTime < 0) startTime = now
    const t = (now - startTime) / 1000
    const ctx = canvas.getContext('2d')!
    const state: FrameState = { t, sceneId, canvasW: canvas.width, canvasH: canvas.height }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const scene = sceneMap[state.sceneId]
    if (scene) {
      scene.draw(ctx, state)
    } else {
      ctx.fillStyle = '#0a0518'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    road.draw(ctx, state)
    character.draw(ctx, state)

    rafId = requestAnimationFrame(render)
  }

  onMount(() => {
    window.addEventListener('resize', onResize)
    if (active) rafId = requestAnimationFrame(render)
  })

  onDestroy(() => {
    window.removeEventListener('resize', onResize)
    cancelAnimationFrame(rafId)
  })

  $: {
    if (typeof window !== 'undefined' && canvas) {
      cancelAnimationFrame(rafId)
      if (active) {
        startTime = -1
        rafId = requestAnimationFrame(render)
      }
    }
  }
</script>

<canvas bind:this={canvas} width={canvasW} height={canvasH} style="display:block;width:100%;height:100%;" />
