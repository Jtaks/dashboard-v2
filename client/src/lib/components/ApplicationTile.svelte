<script lang="ts">
  import type { Application } from '@dashboard/shared';
  import { PLACEHOLDER_ICON_SRC, resolveIconSrc } from '$lib/catalog/icon.js';

  let { application }: { application: Application } = $props();

  let failed = $state(false);
  const imgSrc = $derived(failed ? PLACEHOLDER_ICON_SRC : resolveIconSrc(application.icon));

  $effect(() => {
    void application.icon;
    failed = false;
  });

  function onIconError() {
    failed = true;
  }
</script>

<article data-testid="application-tile" data-app-id={application.id} class="tile">
  <!-- Application URLs are absolute external targets — never compiled into the client. -->
  <!-- prettier-ignore -->
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a href={application.url} data-testid="application-icon-link" data-sveltekit-reload class="icon-link">
    <img src={imgSrc} alt={application.name} width="64" height="64" onerror={onIconError} />
  </a>
  <div class="copy">
    <p data-testid="application-name">{application.name}</p>
    <p data-testid="application-description">{application.description}</p>
  </div>
</article>

<style>
  .tile {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  }

  .icon-link {
    display: inline-flex;
    width: fit-content;
  }

  .icon-link img {
    display: block;
  }

  .copy {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .copy p {
    margin: 0;
  }
</style>
