<script lang="ts">
  import { resolve } from '$app/paths';
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

<li data-testid="application-row" data-app-id={application.id} class="row">
  <!-- Application URLs are absolute external targets — never compiled into the client. -->
  <!-- prettier-ignore -->
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a
    href={application.url}
    data-testid="application-icon-link"
    data-sveltekit-reload
    class="icon-link"
  >
    <img src={imgSrc} alt={application.name} width="48" height="48" onerror={onIconError} />
  </a>
  <a
    href={resolve('/applications/[id]', { id: application.id })}
    data-testid="application-detail-link"
    class="detail-link"
  >
    <p data-testid="application-name">{application.name}</p>
    <p data-testid="application-description">{application.description}</p>
  </a>
</li>

<style>
  .row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .icon-link {
    display: inline-flex;
    flex-shrink: 0;
  }

  .icon-link img {
    display: block;
  }

  .detail-link {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: inherit;
    text-decoration: none;
    min-width: 0;
  }

  .detail-link p {
    margin: 0;
  }
</style>
