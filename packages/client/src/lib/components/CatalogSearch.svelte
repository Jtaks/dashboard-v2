<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  let {
    value = $bindable(''),
  }: {
    value?: string;
  } = $props();
</script>

<div class="catalog-search">
  <label for="catalog-search">{m.catalog_search_label()}</label>
  <input
    id="catalog-search"
    type="search"
    bind:value
    autocomplete="off"
    aria-describedby="catalog-search-description"
  />
  <p id="catalog-search-description" class="catalog-search__description">
    {m.catalog_search_description()}
  </p>
</div>

<style>
  .catalog-search {
    display: grid;
    gap: 0.35rem;
  }

  .catalog-search label {
    font-weight: 600;
  }

  .catalog-search input {
    width: 100%;
    max-width: 24rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid #bbb;
    border-radius: 0.375rem;
    font: inherit;
  }

  .catalog-search__description {
    margin: 0;
    color: #555;
    font-size: 0.875rem;
  }
</style>
