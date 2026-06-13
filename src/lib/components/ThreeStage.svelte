<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createTrippy90sScene } from '../scenes/createTrippy90sScene';
  import type { CharacterDefinition, SceneDefinition } from '../registry/types';

  export let scene: SceneDefinition;
  export let character: CharacterDefinition;
  export let gradientOn: boolean = false;
  export let moonOn: boolean = false;

  let host: HTMLDivElement;
  let experience: ReturnType<typeof createTrippy90sScene> | null = null;
  let mounted = false;
  let bootKey = "";

  function boot() {
    if (!host) return;
    experience?.destroy();
    experience = createTrippy90sScene(host, { scene, character });
    if (import.meta.env.DEV) (window as any).__experience = experience;
  }

  onMount(() => {
    mounted = true;
    bootKey = `${scene.id}:${character.id}`;
    boot();
  });

  $: if (mounted && host && scene && character) {
    const nextKey = `${scene.id}:${character.id}`;
    if (nextKey !== bootKey) {
      bootKey = nextKey;
      boot();
    }
  }

  $: if (experience) experience.setGradient?.(gradientOn);
  $: if (experience) experience.setMoon?.(moonOn);

  onDestroy(() => {
    experience?.destroy();
  });
</script>

<div bind:this={host} class="stage" aria-label="Lo-Fi Stroll 3D stage"></div>
<div id="vignette" aria-hidden="true"></div>

<style>
  .stage {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: #0b0617;
  }

  .stage :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    cursor: default;
  }

  #vignette {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 38% 28%, rgba(255, 255, 255, 0.06), transparent 45%),
      radial-gradient(ellipse at center, transparent 46%, rgba(5, 0, 20, 0.82) 100%);
  }
</style>
