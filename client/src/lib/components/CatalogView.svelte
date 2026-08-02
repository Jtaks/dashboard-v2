<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { ForbiddenError, UnauthorizedError } from '$lib/api/client.js';
  import { catalogQueryOptions } from '$lib/catalog/query.js';
  import { readCatalogView, writeCatalogView, type CatalogViewMode } from '$lib/catalog/view.js';
  import ApplicationRow from '$lib/components/ApplicationRow.svelte';
  import ApplicationTile from '$lib/components/ApplicationTile.svelte';
  import Forbidden from '$lib/components/Forbidden.svelte';
  import SignedOut from '$lib/components/SignedOut.svelte';
  import ViewControl from '$lib/components/ViewControl.svelte';
  import { m } from '$lib/paraglide/messages.js';

  const catalogQuery = createQuery(() => catalogQueryOptions());

  // ssr is off; read once so the first paint matches localStorage.
  let view = $state<CatalogViewMode>(readCatalogView());

  function setView(next: CatalogViewMode) {
    view = next;
    writeCatalogView(next);
  }

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
{:else}
  <section class="catalog" aria-labelledby="catalog-title">
    <header class="catalog-header" data-testid="catalog-header">
      <h1 id="catalog-title">{m.nav_list()}</h1>
      <div class="catalog-header-tools">
        <!-- B4: search field lands in this tools row beside the view control. -->
        <ViewControl {view} onchange={setView} />
      </div>
    </header>

    {#if catalogQuery.isPending}
      <div data-testid="catalog-loading" role="status">{m.catalog_loading()}</div>
    {:else if catalogQuery.isError}
      <section data-testid="catalog-error" aria-labelledby="catalog-error-title">
        <h2 id="catalog-error-title">{m.catalog_error_title()}</h2>
        <p>{m.catalog_error_body()}</p>
        <button type="button" data-testid="catalog-retry" onclick={() => catalogQuery.refetch()}>
          {m.catalog_retry()}
        </button>
      </section>
    {:else if applications.length === 0}
      <section data-testid="catalog-empty" aria-labelledby="catalog-empty-title">
        <h2 id="catalog-empty-title">{m.catalog_empty_title()}</h2>
        <p>{m.catalog_empty_body()}</p>
      </section>
    {:else if view === 'list'}
      <ul data-testid="catalog-list">
        {#each applications as application (application.id)}
          <ApplicationRow {application} />
        {/each}
      </ul>
    {:else}
      <div data-testid="catalog-grid" class="catalog-grid">
        {#each applications as application (application.id)}
          <ApplicationTile {application} />
        {/each}
      </div>
    {/if}
  </section>
{/if}

<style>
  .catalog-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .catalog-header h1 {
    margin: 0;
  }

  .catalog-header-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  .catalog-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 40rem) {
    .catalog-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 64rem) {
    .catalog-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
