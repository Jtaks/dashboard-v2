<script lang="ts">
  import { page } from '$app/stores';
  import { ApiError } from '$lib/api/client.js';
  import AppDetailContent from '$lib/components/AppDetailContent.svelte';
  import { findApplicationInCatalog } from '$lib/catalog/lookup.js';
  import { useCatalogQuery } from '$lib/catalog/query.js';
  import * as m from '$lib/paraglide/messages';

  const catalogQuery = useCatalogQuery();

  const applicationId = $derived($page.params.id);

  const application = $derived.by(() => {
    if (!catalogQuery.data || !applicationId) {
      return undefined;
    }

    return findApplicationInCatalog(catalogQuery.data, applicationId);
  });

  function isAuthError(error: unknown): boolean {
    return error instanceof ApiError && (error.isUnauthorized || error.isForbidden);
  }

  function retryCatalog() {
    void catalogQuery.refetch();
  }
</script>

<main class="app-detail">
  {#if catalogQuery.isPending}
    <p class="app-detail__state app-detail__state--loading" aria-busy="true">{m.catalog_loading()}</p>
  {:else if isAuthError(catalogQuery.error)}
    <!-- 401 and 403 are handled by AuthShell -->
  {:else if catalogQuery.isError}
    <section class="app-detail__state app-detail__state--error" aria-labelledby="app-detail-error-title">
      <h1 id="app-detail-error-title">{m.catalog_error_title()}</h1>
      <p>{m.catalog_error_message()}</p>
      <button type="button" onclick={retryCatalog}>{m.catalog_retry()}</button>
    </section>
  {:else if catalogQuery.data && !application}
    <section class="app-detail__state app-detail__state--not-found" aria-labelledby="app-detail-not-found-title">
      <h1 id="app-detail-not-found-title">{m.app_detail_not_found_title()}</h1>
      <p>{m.app_detail_not_found_message()}</p>
    </section>
  {:else if application}
    <AppDetailContent {application} />
  {/if}
</main>

<style>
  .app-detail__state {
    margin-top: 1rem;
    padding: 1.25rem;
    border-radius: 0.5rem;
  }

  .app-detail__state--loading {
    color: #444;
  }

  .app-detail__state--error {
    border: 1px solid #c62828;
    background: #ffebee;
  }

  .app-detail__state--error button {
    margin-top: 0.75rem;
  }

  .app-detail__state--not-found {
    border: 1px solid #ccc;
    background: #fafafa;
  }
</style>
