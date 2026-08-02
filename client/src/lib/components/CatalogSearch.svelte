<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';

  let {
    value = $bindable(''),
  }: {
    value?: string;
  } = $props();

  function clear() {
    value = '';
  }
</script>

<div class="catalog-search" data-testid="catalog-search">
  <label for="catalog-search-input">{m.catalog_search_label()}</label>
  <p id="catalog-search-description" class="visually-hidden">{m.catalog_search_description()}</p>
  <div class="catalog-search-controls">
    <input
      id="catalog-search-input"
      type="search"
      data-testid="catalog-search-input"
      bind:value
      aria-describedby="catalog-search-description"
      autocomplete="off"
      spellcheck="false"
    />
    {#if value.length > 0}
      <button type="button" data-testid="catalog-search-clear" onclick={clear}>
        {m.catalog_search_clear()}
      </button>
    {/if}
  </div>
</div>

<style>
  .catalog-search {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: min(100%, 16rem);
  }

  .catalog-search-controls {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  input {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0.35rem 0.5rem;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    background: transparent;
    color: inherit;
  }

  button {
    flex: 0 0 auto;
    padding: 0.35rem 0.5rem;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
