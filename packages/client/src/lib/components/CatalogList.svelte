<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { browser } from '$app/environment';
  import { ApiError } from '$lib/api/client.js';
  import { filterApplications } from '$lib/catalog/filter.js';
  import { useCatalogQuery } from '$lib/catalog/query.js';
  import {
    readCatalogView,
    writeCatalogView,
    type CatalogView,
  } from '$lib/storage/view.js';
  import * as m from '$lib/paraglide/messages';

  import ApplicationRow from './ApplicationRow.svelte';
  import CatalogGrid from './CatalogGrid.svelte';
  import CatalogSearch from './CatalogSearch.svelte';
  import CatalogViewToggle from './CatalogViewToggle.svelte';

  const catalogQuery = useCatalogQuery();

  let searchQuery = $state('');
  let view = $state<CatalogView>(browser ? readCatalogView() : 'list');

  const filteredApplications = $derived.by(() => {
    if (!catalogQuery.data) {
      return [];
    }

    return filterApplications(catalogQuery.data.applications, searchQuery);
  });

  const hasActiveSearch = $derived(searchQuery.trim().length > 0);
  const showCatalogControls = $derived(
    catalogQuery.data !== undefined && catalogQuery.data.applications.length > 0,
  );
  const showNoResults = $derived(
    showCatalogControls && hasActiveSearch && filteredApplications.length === 0,
  );

  $effect(() => {
    writeCatalogView(view);
  });

  function isAuthError(error: unknown): boolean {
    return error instanceof ApiError && (error.isUnauthorized || error.isForbidden);
  }

  function retryCatalog() {
    void catalogQuery.refetch();
  }

  function clearSearch() {
    searchQuery = '';
  }

  if (browser) {
    afterNavigate(({ to }) => {
      if (to?.url.pathname === '/') {
        document.getElementById('catalog-page-heading')?.focus();
      }
    });
  }
</script>

<main>
  <header class="catalog-header">
    <h1 id="catalog-page-heading" tabindex="-1">{m.page_home_title()}</h1>

    {#if showCatalogControls}
      <div class="catalog-header__controls">
        <CatalogSearch bind:value={searchQuery} />
        <CatalogViewToggle bind:view />
      </div>
    {/if}
  </header>

  {#if catalogQuery.isPending}
    <p class="catalog-state catalog-state--loading" aria-busy="true">{m.catalog_loading()}</p>
  {:else if isAuthError(catalogQuery.error)}
    <!-- 401 and 403 are handled by AuthShell -->
  {:else if catalogQuery.isError}
    <section class="catalog-state catalog-state--error" aria-labelledby="catalog-error-title">
      <h2 id="catalog-error-title">{m.catalog_error_title()}</h2>
      <p>{m.catalog_error_message()}</p>
      <button type="button" onclick={retryCatalog}>{m.catalog_retry()}</button>
    </section>
  {:else if catalogQuery.data && catalogQuery.data.applications.length === 0}
    <section class="catalog-state catalog-state--empty" aria-labelledby="catalog-empty-title">
      <h2 id="catalog-empty-title">{m.catalog_empty_title()}</h2>
      <p>{m.catalog_empty_message()}</p>
    </section>
  {:else if showNoResults}
    <section class="catalog-state catalog-state--no-results" aria-labelledby="catalog-no-results-title">
      <h2 id="catalog-no-results-title">{m.catalog_no_results_title()}</h2>
      <p>{m.catalog_no_results_message()}</p>
      <button type="button" onclick={clearSearch}>{m.catalog_search_clear()}</button>
    </section>
  {:else if catalogQuery.data}
    {#if view === 'grid'}
      <CatalogGrid applications={filteredApplications} />
    {:else}
      <ul class="catalog-list">
        {#each filteredApplications as application (application.id)}
          <li>
            <ApplicationRow {application} applicationId={application.id} />
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</main>

<style>
  .catalog-header {
    display: grid;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  #catalog-page-heading:focus-visible {
    outline: 2px solid #1a237e;
    outline-offset: 2px;
  }

  .catalog-header__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
  }

  .catalog-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 1.25rem;
  }

  .catalog-state {
    margin-top: 1rem;
    padding: 1.25rem;
    border-radius: 0.5rem;
  }

  .catalog-state--loading {
    color: #444;
  }

  .catalog-state--empty,
  .catalog-state--no-results {
    border: 1px solid #ccc;
    background: #fafafa;
  }

  .catalog-state--error {
    border: 1px solid #c62828;
    background: #ffebee;
  }

  .catalog-state--error button,
  .catalog-state--no-results button {
    margin-top: 0.75rem;
  }
</style>
