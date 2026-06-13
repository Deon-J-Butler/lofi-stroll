<script lang="ts">
  import ThreeStage from './lib/components/ThreeStage.svelte';
  import { scenes } from './lib/registry/scenes';
  import { characters } from './lib/registry/characters';

  let selectedSceneId = scenes[0].id;
  let selectedCharacterId = characters[0].id;
  let studioOpen = true;
  let hintGone = false;

  $: selectedScene = scenes.find((item) => item.id === selectedSceneId) ?? scenes[0];
  $: selectedCharacter = characters.find((item) => item.id === selectedCharacterId) ?? characters[0];

  setTimeout(() => {
    hintGone = true;
  }, 6000);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (key === 'f') toggleFullscreen();
    if (key === 'h') studioOpen = !studioOpen;
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<ThreeStage scene={selectedScene} character={selectedCharacter} />

<section class:collapsed={!studioOpen} class="studio-panel" aria-label="Lo-Fi Stroll Studio controls">
  <button class="panel-toggle" on:click={() => (studioOpen = !studioOpen)} aria-label="Toggle studio panel">
    {studioOpen ? 'hide' : 'show'} studio
  </button>

  {#if studioOpen}
    <h1>Lo-Fi Stroll Studio</h1>
    <label>
      Scene
      <select bind:value={selectedSceneId}>
        {#each scenes as scene}
          <option value={scene.id}>{scene.label}</option>
        {/each}
      </select>
    </label>

    <label>
      Character
      <select bind:value={selectedCharacterId}>
        {#each characters as character}
          <option value={character.id}>{character.label}</option>
        {/each}
      </select>
    </label>

    <p>{selectedScene.description}</p>
    <p>{selectedCharacter.notes}</p>
    <div class="keys">F fullscreen · H panel</div>
  {/if}
</section>

<div id="hint" class:gone={hintGone}>F · fullscreen &nbsp;·&nbsp; H · studio panel</div>

<style>
  .studio-panel {
    position: fixed;
    top: 18px;
    left: 18px;
    z-index: 5;
    width: min(330px, calc(100vw - 36px));
    padding: 16px;
    color: rgba(255, 255, 255, 0.86);
    background: rgba(10, 5, 25, 0.62);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 18px;
    backdrop-filter: blur(10px);
    box-shadow: 0 12px 42px rgba(0, 0, 0, 0.28);
  }

  .studio-panel.collapsed {
    width: auto;
    padding: 10px;
  }

  h1 {
    margin: 0 0 14px;
    font-size: 14px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  label {
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  select,
  button {
    color: white;
    background: rgba(10, 5, 28, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 999px;
    padding: 8px 10px;
    color-scheme: dark;
  }

  select option {
    background: #160a30;
    color: rgba(255, 255, 255, 0.92);
  }

  .panel-toggle {
    cursor: pointer;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 11px;
  }

  p {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.72);
  }

  .keys {
    margin-top: 12px;
    font-size: 11px;
    letter-spacing: 0.12em;
    color: rgba(255, 255, 255, 0.66);
    text-transform: uppercase;
  }

  #hint {
    position: fixed;
    left: 50%;
    bottom: 28px;
    z-index: 6;
    transform: translateX(-50%);
    font: 13px/1.4 "Courier New", monospace;
    letter-spacing: 0.12em;
    color: rgba(255, 255, 255, 0.75);
    background: rgba(10, 5, 25, 0.55);
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    transition: opacity 1.2s ease;
    pointer-events: none;
    text-transform: uppercase;
  }

  #hint.gone {
    opacity: 0;
  }
</style>
