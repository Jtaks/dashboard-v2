<script lang="ts">
  import { resolve } from '$app/paths';
  import { createQuery } from '@tanstack/svelte-query';
  import type { Session } from '@dashboard/shared';
  import Settings from '@lucide/svelte/icons/settings';
  import { ForbiddenError, UnauthorizedError } from '$lib/api/client.js';
  import { fetchSession, sessionQueryKey } from '$lib/auth/session.js';
  import { alertsQueryOptions } from '$lib/alerts/query.js';
  import AlertBanners from '$lib/components/AlertBanners.svelte';
  import Forbidden from '$lib/components/Forbidden.svelte';
  import SignedOut from '$lib/components/SignedOut.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { statusQueryOptions } from '$lib/status/query.js';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  const sessionQuery = createQuery(() => ({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    retry: false,
  }));

  // C3: one shared status poll for the signed-in shell (C4/C5 subscribe to the same key).
  const statusQuery = createQuery(() => ({
    ...statusQueryOptions(),
    enabled: Boolean(sessionQuery.data),
  }));

  // E3: targeted alerts for the banner (same enable gate as status).
  const alertsQuery = createQuery(() => ({
    ...alertsQueryOptions(),
    enabled: Boolean(sessionQuery.data),
  }));

  const session = $derived(sessionQuery.data as Session | undefined);
  const error = $derived(sessionQuery.error);
  const unauthorized = $derived(
    error instanceof UnauthorizedError
      ? error
      : statusQuery.error instanceof UnauthorizedError
        ? statusQuery.error
        : alertsQuery.error instanceof UnauthorizedError
          ? alertsQuery.error
          : null,
  );
  const forbidden = $derived(
    error instanceof ForbiddenError
      ? error
      : statusQuery.error instanceof ForbiddenError
        ? statusQuery.error
        : alertsQuery.error instanceof ForbiddenError
          ? alertsQuery.error
          : null,
  );
  const alerts = $derived(alertsQuery.data ?? null);
</script>

{#if unauthorized}
  <SignedOut location={unauthorized.location} />
{:else if forbidden}
  <Forbidden code={forbidden.code} />
{:else if sessionQuery.isPending}
  <div data-testid="session-loading"></div>
{:else if session}
  <header class="app-header">
    <a href={resolve('/')}>{m.app_name()}</a>
    <nav aria-label={m.app_name()} class="app-nav">
      <a href={resolve('/')}>{m.nav_list()}</a>
      <a
        href={resolve('/settings')}
        data-testid="nav-settings"
        aria-label={m.nav_settings()}
        class="nav-settings"
      >
        <Settings aria-hidden="true" size={18} />
      </a>
      {#if session.admin}
        <a href={resolve('/admin')}>{m.nav_admin()}</a>
      {/if}
      <!-- External Authelia logout URL from the session response — never compiled in. -->
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a href={session.logoutUrl} data-testid="sign-out" data-sveltekit-reload>{m.nav_sign_out()}</a
      >
    </nav>
  </header>
  <AlertBanners alerts={alerts} />
  {@render children()}
{:else}
  <SignedOut location={null} />
{/if}

<style>
  .app-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-width: 0;
    max-width: 100%;
    padding: 0.75rem 1rem;
  }

  .app-nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .nav-settings {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.35rem;
  }
</style>
