<script lang="ts">
  import type { Snippet } from 'svelte';

  type SettingsSectionProps = {
    headingId: string;
    heading: string;
    testId?: string;
    children: Snippet;
  };

  let { headingId, heading, testId, children }: SettingsSectionProps = $props();
</script>

<section class="settings-section" aria-labelledby={headingId} data-testid={testId}>
  <h2 id={headingId}>{heading}</h2>
  <div class="settings-section__body">
    {@render children()}
  </div>
</section>

<style>
  .settings-section {
    margin: 0 0 2rem;
  }

  .settings-section h2 {
    font-size: 1.125rem;
    margin: 0 0 0.75rem;
  }

  .settings-section__body {
    display: grid;
    gap: 0.75rem;
  }
</style>
