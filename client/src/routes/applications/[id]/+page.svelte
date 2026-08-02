<script lang="ts">
  import { page } from '$app/state';
  import { createQuery } from '@tanstack/svelte-query';
  import { ForbiddenError, UnauthorizedError } from '$lib/api/client.js';
  import { findApplicationById } from '$lib/catalog/lookup.js';
  import { catalogQueryOptions } from '$lib/catalog/query.js';
  import Forbidden from '$lib/components/Forbidden.svelte';
  import SignedOut from '$lib/components/SignedOut.svelte';
  import { m } from '$lib/paraglide/messages.js';

  const catalogQuery = createQuery(() => catalogQueryOptions());

  const applicationId = $derived(page.params.id ?? '');
  const application = $derived(findApplicationById(catalogQuery.data, applicationId));

  const unauthorized = $derived(
    catalogQuery.error instanceof UnauthorizedError ? catalogQuery.error : null,
  );
  const forbidden = $derived(
    catalogQuery.error instanceof ForbiddenError ? catalogQuery.error : null,
  );
</script>

{#if unauthorized}
  <SignedOut location={unauthorized.location} />
{:else if forbidden}
  <Forbidden code={forbidden.code} />
{:else if catalogQuery.isPending}
  <div data-testid="detail-loading" role="status">{m.catalog_loading()}</div>
{:else if catalogQuery.isError}
  <section data-testid="detail-error" aria-labelledby="detail-error-title">
    <h1 id="detail-error-title">{m.catalog_error_title()}</h1>
    <p>{m.catalog_error_body()}</p>
    <button type="button" data-testid="detail-retry" onclick={() => catalogQuery.refetch()}>
      {m.catalog_retry()}
    </button>
  </section>
{:else if !application}
  <section data-testid="detail-not-found" aria-labelledby="detail-not-found-title">
    <h1 id="detail-not-found-title">{m.detail_not_found_title()}</h1>
    <p>{m.detail_not_found_body()}</p>
  </section>
{:else}
  <article data-testid="application-detail" data-app-id={application.id}>
    <header class="detail-header">
      <h1 data-testid="application-name">{application.name}</h1>
      <p data-testid="application-description">{application.description}</p>
      <!-- Application URLs are absolute external targets — never compiled into the client. -->
      <!-- prettier-ignore -->
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a href={application.url} data-testid="application-open-link" data-sveltekit-reload>
        {m.detail_open()}
      </a>
    </header>

    <!-- Reserved for C5: per-service status and uptime. -->
    <section
      data-testid="application-status-detail"
      aria-label={m.detail_status_label()}
    ></section>
  </article>
{/if}

<style>
  .detail-header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .detail-header h1,
  .detail-header p {
    margin: 0;
  }
</style>
