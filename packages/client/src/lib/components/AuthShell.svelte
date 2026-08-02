<script lang="ts">
  import { page } from '$app/stores';
  import { ApiError } from '$lib/api/client.js';
  import { fetchSession } from '$lib/api/session.js';
  import { statusQueryOptions } from '$lib/status/query.js';
  import Refusal from '$lib/components/Refusal.svelte';
  import SignIn from '$lib/components/SignIn.svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import type { Snippet } from 'svelte';

  import { runPushOnLoad } from '$lib/push/load.js';

  import AlertsBanner from './AlertsBanner.svelte';
  import ApplicationChrome from './ApplicationChrome.svelte';
  import Nav from './Nav.svelte';
  import PushPermissionPrompt from './PushPermissionPrompt.svelte';

  type AuthShellProps = {
    children: Snippet;
    refusal?: boolean;
  };

  let { children, refusal = false }: AuthShellProps = $props();

  const requireAdmin = $derived($page.url.pathname.startsWith('/admin'));

  const sessionQuery = createQuery(() => ({
    queryKey: ['session'],
    queryFn: fetchSession,
    retry: false,
  }));

  const statusQuery = createQuery(() => ({
    ...statusQueryOptions(),
    enabled: Boolean(sessionQuery.data),
  }));

  function readErrorStatus(error: unknown): number | null {
    if (error instanceof ApiError) {
      return error.status;
    }

    if (typeof error === 'object' && error !== null && 'status' in error) {
      const status = (error as { status: unknown }).status;
      return typeof status === 'number' ? status : null;
    }

    return null;
  }

  function readUnauthorizedLocation(error: unknown): string | null {
    const status = readErrorStatus(error);
    if (status !== 401) {
      return null;
    }

    if (error instanceof ApiError) {
      return error.location ?? '/';
    }

    if (typeof error === 'object' && error !== null && 'location' in error) {
      const location = (error as { location: unknown }).location;
      return typeof location === 'string' ? location : '/';
    }

    return '/';
  }

  const signInUrl = $derived.by(
    () => readUnauthorizedLocation(sessionQuery.error) ?? readUnauthorizedLocation(statusQuery.error),
  );

  const showRefusal = $derived(
    refusal ||
      (requireAdmin && sessionQuery.data && !sessionQuery.data.admin) ||
      readErrorStatus(sessionQuery.error) === 403 ||
      readErrorStatus(statusQuery.error) === 403,
  );
  const showSignIn = $derived(signInUrl !== null);

  let pushPromptRegistration = $state<ServiceWorkerRegistration | null>(null);

  $effect(() => {
    if (!sessionQuery.data) {
      pushPromptRegistration = null;
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await runPushOnLoad();
      if (!cancelled) {
        pushPromptRegistration = result.showPrompt ? result.registration : null;
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  function closePushPrompt() {
    pushPromptRegistration = null;
  }
</script>

{#if sessionQuery.isPending}
  <p aria-busy="true"></p>
{:else if showRefusal}
  <Refusal />
{:else if showSignIn && signInUrl}
  <SignIn {signInUrl} />
{:else if sessionQuery.data}
  <div class="app-shell">
    <ApplicationChrome />
    <Nav session={sessionQuery.data} />
    <AlertsBanner />
    {#if pushPromptRegistration}
      <PushPermissionPrompt registration={pushPromptRegistration} onClose={closePushPrompt} />
    {/if}
    {@render children()}
  </div>
{/if}

<style>
  .app-shell {
    box-sizing: border-box;
    margin: 0 auto;
    max-width: 64rem;
    overflow-x: clip;
    padding: 0 1rem 2rem;
    width: 100%;
  }
</style>
