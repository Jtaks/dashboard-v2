import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '200.html',
      precompress: false,
      strict: true,
    }),
    alias: {
      '@dashboard/shared': '../shared/src/index.ts',
    },
    paths: {
      // Absolute asset URLs so the SPA fallback does not break deep routes.
      relative: false,
    },
    serviceWorker: {
      register: true,
    },
  },
};

export default config;
