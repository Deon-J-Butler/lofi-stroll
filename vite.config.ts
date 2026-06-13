import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: '/lofi-stroll',
  assetsInclude: ['**/*.glb', '**/*.gltf'],
  server: {
    host: '0.0.0.0'
  }
});
