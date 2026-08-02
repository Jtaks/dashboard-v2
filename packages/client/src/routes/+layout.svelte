<script lang="ts">
import '$lib/styles/global.css';

import { browser } from '$app/environment';
import AuthShell from '$lib/components/AuthShell.svelte';
import * as m from '$lib/paraglide/messages';
import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

let { children } = $props();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
});

if (browser && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/service-worker.js');
}
</script>

<svelte:head>
  <title>{m.app_title()}</title>
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#1565c0" />
  <link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png" />
</svelte:head>

<QueryClientProvider client={queryClient}>
  <AuthShell>
    {@render children()}
  </AuthShell>
</QueryClientProvider>
