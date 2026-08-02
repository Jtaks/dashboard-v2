<script lang="ts">
  import type { Application } from '@dashboard/shared';
  import ServiceList from '$lib/components/ServiceList.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import * as m from '$lib/paraglide/messages';
  import { useApplicationStatus } from '$lib/status/accessor.js';
  import { formatUptime } from '$lib/status/duration.js';

  let { application }: { application: Application } = $props();

  const statusState = $derived.by(() => useApplicationStatus(application.id));
  const applicationStatus = $derived(statusState.status);
  const badgeStatus = $derived(applicationStatus?.status ?? null);
  const now = $derived(
    statusState.collectedAt ? new Date(statusState.collectedAt) : new Date(),
  );
  const applicationUptime = $derived(formatUptime(applicationStatus?.since ?? null, now));
</script>

<header class="app-detail__header">
  <h1>{application.name}</h1>
  <div class="app-detail__status-summary">
    <StatusBadge status={badgeStatus} />
    {#if applicationUptime}
      <span class="app-detail__uptime">{applicationUptime}</span>
    {/if}
  </div>
</header>
<p class="app-detail__description">{application.description}</p>
<p>
  <a class="app-detail__open" href={application.url}>
    {m.catalog_open_app({ name: application.name })}
  </a>
</p>
<section
  class="app-detail__status"
  aria-labelledby="app-detail-status-heading"
  data-status-region="true"
>
  <h2 id="app-detail-status-heading" class="app-detail__status-heading">
    {m.app_detail_status_region()}
  </h2>
  <ServiceList {application} applicationId={application.id} />
</section>

<style>
  .app-detail__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1rem;
  }

  .app-detail__header h1 {
    margin: 0;
  }

  .app-detail__status-summary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .app-detail__uptime {
    font-size: 0.875rem;
    color: #555;
  }

  .app-detail__description {
    margin: 0.5rem 0 1rem;
    color: #444;
  }

  .app-detail__status {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #ddd;
  }

  .app-detail__status-heading {
    font-size: 1rem;
    margin: 0;
    color: #444;
  }
</style>
