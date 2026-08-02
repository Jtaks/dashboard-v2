<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import AppShell from '$lib/components/AppShell.svelte';
  import '$lib/styles/tokens.css';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  // After client-side navigations, land focus on the route's named target instead of <body>.
  afterNavigate(({ from }) => {
    if (!from) {
      return;
    }
    const target = document.querySelector<HTMLElement>('[data-route-focus-target]');
    target?.focus({ preventScroll: true });
  });
</script>

<QueryClientProvider client={queryClient}>
  <AppShell>
    {@render children()}
  </AppShell>
</QueryClientProvider>
