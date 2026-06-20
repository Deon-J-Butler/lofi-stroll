<script lang="ts">
  import ThreeStage from './lib/components/ThreeStage.svelte';
  import IllustratedStage from './lib/illustrated/IllustratedStage.svelte';
  import { illustratedMode } from './lib/illustrated/store';
  import { scenes } from './lib/registry/scenes';
  import { characters } from './lib/registry/characters';

  let selectedSceneId = scenes[0].id;
  let selectedCharacterId = characters[0].id;
  // Start collapsed on small screens so the panel never covers the view on load.
  let studioOpen = typeof window === 'undefined' || window.innerWidth > 700;
  let gradientOn = false;
  let moonOn = false;
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

<div style={$illustratedMode ? 'display:none' : ''}>
  <ThreeStage scene={selectedScene} character={selectedCharacter} {gradientOn} {moonOn} />
</div>

<div style={$illustratedMode ? '' : 'display:none'} class="illustrated-wrap">
  <IllustratedStage sceneId={selectedSceneId} active={$illustratedMode} />
</div>

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
    <button class="mode-toggle" class:active={moonOn} on:click={() => (moonOn = !moonOn)}>
      {moonOn ? 'night' : 'day'}
    </button>
    <button class="gradient-toggle" class:active={gradientOn} on:click={() => (gradientOn = !gradientOn)}>
      {gradientOn ? 'RGB on' : 'RGB off'}
    </button>
    <button
      class="illustrated-toggle"
      class:active={$illustratedMode}
      on:click={() => illustratedMode.update(v => !v)}
    >
      {$illustratedMode ? 'illustrated' : '3D'}
    </button>
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
    max-height: calc(100dvh - 36px);
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
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
    max-height: none;
    overflow: visible;
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

  .gradient-toggle {
    margin-top: 12px;
    width: 100%;
    color: #b8a4ad;
    border-color: rgba(184, 164, 173, 0.42);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
  }

  .mode-toggle {
    margin-top: 12px;
    width: 100%;
    color: #c9cbd0;
    border-color: rgba(201, 203, 208, 0.38);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
  }

  .gradient-toggle.active {
    background: rgba(122, 92, 104, 0.14);
    border-color: rgba(188, 154, 166, 0.72);
    color: #d8c4cc;
    box-shadow: 0 0 10px rgba(140, 110, 120, 0.22);
  }

  .mode-toggle.active {
    background: rgba(180, 186, 198, 0.14);
    border-color: rgba(220, 224, 232, 0.72);
    color: #eef0f4;
    box-shadow: 0 0 12px rgba(160, 170, 190, 0.24);
  }

  .keys {
    margin-top: 12px;
    font-size: 11px;
    letter-spacing: 0.12em;
    color: rgba(255, 255, 255, 0.66);
    text-transform: uppercase;
  }

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

  /* ---- mobile: keep the studio panel out of the way of the scene ---- */
  @media (max-width: 700px) {
    .studio-panel {
      top: 10px;
      left: 10px;
      right: 10px;
      width: auto;
      max-height: 70dvh;
      padding: 12px 14px;
      border-radius: 14px;
    }

    .studio-panel.collapsed {
      right: auto;
      width: auto;
      padding: 9px 12px;
    }

    h1 {
      margin-bottom: 10px;
      font-size: 13px;
    }

    label {
      margin-bottom: 10px;
    }

    /* trim the descriptive copy so the panel stays short on a phone */
    p {
      font-size: 11px;
      line-height: 1.4;
    }

    select,
    button {
      padding: 10px 12px;
      font-size: 12px;
    }

    .keys {
      display: none;
    }

    #hint {
      bottom: 16px;
      font-size: 11px;
      padding: 7px 12px;
    }
  }

  /* phones in landscape have very little height — keep the panel scrollable + short */
  @media (max-height: 480px) {
    .studio-panel {
      max-height: calc(100dvh - 20px);
    }
  }
</style>
