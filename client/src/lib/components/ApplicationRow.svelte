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

<li data-testid="application-row" data-app-id={application.id}>
  <!-- Application URLs are absolute external targets — never compiled into the client. -->
  <!-- prettier-ignore -->
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a href={application.url} data-testid="application-icon-link" data-sveltekit-reload>
    <img src={imgSrc} alt={application.name} width="48" height="48" onerror={onIconError} />
  </a>
  <div>
    <p data-testid="application-name">{application.name}</p>
    <p data-testid="application-description">{application.description}</p>
  </div>
</li>
