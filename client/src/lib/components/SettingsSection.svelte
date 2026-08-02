<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    id,
    heading,
    children,
  }: {
    /** Stable section id for tests and later mounts (e.g. `flags`, `notifications`). */
    id: string;
    heading: string;
    children?: Snippet;
  } = $props();

  const headingId = $derived(`settings-section-${id}-heading`);
</script>

<section
  class="settings-section"
  data-testid="settings-section-{id}"
  data-settings-section={id}
  aria-labelledby={headingId}
>
  <h2 id={headingId} class="settings-section-heading">{heading}</h2>
  <div class="settings-section-body" data-testid="settings-section-{id}-body">
    {#if children}
      {@render children()}
    {/if}
  </div>
</section>

<style>
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
    max-width: 100%;
  }

  .settings-section-heading {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .settings-section-body {
    min-width: 0;
    max-width: 100%;
  }
</style>
