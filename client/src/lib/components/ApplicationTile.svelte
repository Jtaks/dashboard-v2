<script lang="ts">
  import { resolve } from '$app/paths';
  import type { Application, StatusReport } from '@dashboard/shared';
  import { PLACEHOLDER_ICON_SRC, resolveIconSrc } from '$lib/catalog/icon.js';
  import DependencySummary from '$lib/components/DependencySummary.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { getApplicationStatus } from '$lib/status/accessors.js';

  let {
    application,
    statusReport = null,
  }: {
    application: Application;
    /** Shared C3 status report — never fetched here. */
    statusReport?: StatusReport | null;
  } = $props();

  const applicationStatus = $derived(getApplicationStatus(statusReport, application.id));
  const status = $derived(applicationStatus?.status ?? null);

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
  <div class="tile-top">
    <!-- Application URLs are absolute external targets — never compiled into the client. -->
    <!-- eslint-disable svelte/no-navigation-without-resolve -->
    <a
      href={application.url}
      data-testid="application-icon-link"
      data-sveltekit-reload
      class="icon-link"
    >
      <img src={imgSrc} alt={application.name} width="64" height="64" onerror={onIconError} />
    </a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
    <div class="status-chrome" data-testid="application-status">
      <StatusBadge {status} />
    </div>
  </div>
  <a
    href={resolve('/applications/[id]', { id: application.id })}
    data-testid="application-detail-link"
    class="detail-link"
  >
    <p data-testid="application-name">{application.name}</p>
    <p data-testid="application-description">{application.description}</p>
  </a>
  <DependencySummary {application} {applicationStatus} />
</article>

<style>
  .tile {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  }

  .tile-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .icon-link {
    display: inline-flex;
    width: fit-content;
  }

  .icon-link img {
    display: block;
  }

  .status-chrome {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.35rem;
  }

  .detail-link {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: inherit;
    text-decoration: none;
  }

  .detail-link p {
    margin: 0;
  }
</style>
