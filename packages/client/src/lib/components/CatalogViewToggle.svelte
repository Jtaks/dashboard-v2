<script lang="ts">
  import type { CatalogView } from '$lib/storage/view.js';
  import * as m from '$lib/paraglide/messages';

  let {
    view = $bindable('list' as CatalogView),
  }: {
    view?: CatalogView;
  } = $props();

  function selectList() {
    view = 'list';
  }

  function selectGrid() {
    view = 'grid';
  }
</script>

<div class="catalog-view-toggle" role="group" aria-label={m.catalog_view_toggle_label()}>
  <button
    type="button"
    aria-pressed={view === 'list'}
    onclick={selectList}
  >
    {m.catalog_view_list()}
  </button>
  <button
    type="button"
    aria-pressed={view === 'grid'}
    onclick={selectGrid}
  >
    {m.catalog_view_grid()}
  </button>
</div>

<style>
  .catalog-view-toggle {
    display: inline-flex;
    gap: 0.5rem;
  }

  .catalog-view-toggle button {
    font: inherit;
    padding: 0.4rem 0.75rem;
    border: 1px solid #bbb;
    border-radius: 0.375rem;
    background: #fff;
    cursor: pointer;
  }

  .catalog-view-toggle button[aria-pressed='true'] {
    border-color: #1a237e;
    background: #e8eaf6;
  }

  .catalog-view-toggle button:focus-visible {
    outline: 2px solid #1a237e;
    outline-offset: 2px;
  }
</style>
