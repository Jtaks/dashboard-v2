<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { ForbiddenError, UnauthorizedError } from '$lib/api/client.js';
  import { catalogQueryOptions } from '$lib/catalog/query.js';
  import ApplicationRow from '$lib/components/ApplicationRow.svelte';
  import Forbidden from '$lib/components/Forbidden.svelte';
  import SignedOut from '$lib/components/SignedOut.svelte';
  import { m } from '$lib/paraglide/messages.js';

  const catalogQuery = createQuery(() => catalogQueryOptions());

  const unauthorized = $derived(
    catalogQuery.error instanceof UnauthorizedError ? catalogQuery.error : null,
  );
  const forbidden = $derived(
    catalogQuery.error instanceof ForbiddenError ? catalogQuery.error : null,
  );
  const applications = $derived(catalogQuery.data?.applications ?? []);
</script>

{#if unauthorized}
  <SignedOut location={unauthorized.location} />
{:else if forbidden}
  <Forbidden code={forbidden.code} />
{:else if catalogQuery.isPending}
  <div data-testid="catalog-loading" role="status">{m.catalog_loading()}</div>
{:else if catalogQuery.isError}
  <section data-testid="catalog-error" aria-labelledby="catalog-error-title">
    <h1 id="catalog-error-title">{m.catalog_error_title()}</h1>
    <p>{m.catalog_error_body()}</p>
    <button type="button" data-testid="catalog-retry" onclick={() => catalogQuery.refetch()}>
      {m.catalog_retry()}
    </button>
  </section>
{:else if applications.length === 0}
  <section data-testid="catalog-empty" aria-labelledby="catalog-empty-title">
    <h1 id="catalog-empty-title">{m.catalog_empty_title()}</h1>
    <p>{m.catalog_empty_body()}</p>
  </section>
{:else}
  <section data-testid="catalog-list" aria-labelledby="catalog-list-title">
    <h1 id="catalog-list-title">{m.nav_list()}</h1>
    <ul>
      {#each applications as application (application.id)}
        <ApplicationRow {application} />
      {/each}
    </ul>
  </section>
{/if}
