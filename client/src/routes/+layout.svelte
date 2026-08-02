<script lang="ts">
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import AppShell from '$lib/components/AppShell.svelte';
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
</script>

<QueryClientProvider client={queryClient}>
  <AppShell>
    {@render children()}
  </AppShell>
</QueryClientProvider>
