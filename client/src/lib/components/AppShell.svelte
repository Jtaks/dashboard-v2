<script lang="ts">
  import { resolve } from '$app/paths';
  import { createQuery } from '@tanstack/svelte-query';
  import type { Session } from '@dashboard/shared';
  import { ForbiddenError, UnauthorizedError } from '$lib/api/client.js';
  import { fetchSession, sessionQueryKey } from '$lib/auth/session.js';
  import Forbidden from '$lib/components/Forbidden.svelte';
  import SignedOut from '$lib/components/SignedOut.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  const sessionQuery = createQuery(() => ({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    retry: false,
  }));

  const session = $derived(sessionQuery.data as Session | undefined);
  const error = $derived(sessionQuery.error);
  const unauthorized = $derived(error instanceof UnauthorizedError ? error : null);
  const forbidden = $derived(error instanceof ForbiddenError ? error : null);
</script>

{#if unauthorized}
  <SignedOut location={unauthorized.location} />
{:else if forbidden}
  <Forbidden code={forbidden.code} />
{:else if sessionQuery.isPending}
  <div data-testid="session-loading"></div>
{:else if session}
  <header>
    <a href={resolve('/')}>{m.app_name()}</a>
    <nav aria-label={m.app_name()}>
      <a href={resolve('/')}>{m.nav_list()}</a>
      <a href={resolve('/settings')}>{m.nav_settings()}</a>
      {#if session.admin}
        <a href={resolve('/admin')}>{m.nav_admin()}</a>
      {/if}
      <!-- External Authelia logout URL from the session response — never compiled in. -->
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a href={session.logoutUrl} data-testid="sign-out" data-sveltekit-reload>{m.nav_sign_out()}</a
      >
    </nav>
  </header>
  {@render children()}
{:else}
  <SignedOut location={null} />
{/if}
