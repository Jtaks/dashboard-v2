<script lang="ts">
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import List from '@lucide/svelte/icons/list';
  import type { CatalogViewMode } from '$lib/catalog/view.js';
  import { m } from '$lib/paraglide/messages.js';

  let {
    view,
    onchange,
  }: {
    view: CatalogViewMode;
    onchange: (next: CatalogViewMode) => void;
  } = $props();
</script>

<div
  role="group"
  aria-label={m.catalog_view_label()}
  data-testid="catalog-view-control"
  class="view-control"
>
  <button
    type="button"
    data-testid="catalog-view-list"
    aria-pressed={view === 'list'}
    aria-label={m.catalog_view_list()}
    onclick={() => onchange('list')}
  >
    <List aria-hidden="true" size={18} />
  </button>
  <button
    type="button"
    data-testid="catalog-view-grid"
    aria-pressed={view === 'grid'}
    aria-label={m.catalog_view_grid()}
    onclick={() => onchange('grid')}
  >
    <LayoutGrid aria-hidden="true" size={18} />
  </button>
</div>

<style>
  .view-control {
    display: inline-flex;
    gap: 0.25rem;
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.35rem;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  button[aria-pressed='true'] {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
</style>
