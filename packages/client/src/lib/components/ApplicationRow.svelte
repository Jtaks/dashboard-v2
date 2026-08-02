<script lang="ts">
  import type { Application } from '@dashboard/shared';
  import { resolve } from '$app/paths';
  import { useApplicationStatus } from '$lib/status/accessor.js';

  import ApplicationIcon from './ApplicationIcon.svelte';
  import DependencySummary from './DependencySummary.svelte';
  import StatusBadge from './StatusBadge.svelte';

  let {
    application,
    applicationId,
  }: {
    application: Application;
    applicationId: string;
  } = $props();

  const detailHref = $derived(resolve(`/apps/${applicationId}`));
  const statusState = $derived.by(() => useApplicationStatus(applicationId));
  const applicationStatus = $derived(statusState.status);
  const badgeStatus = $derived(applicationStatus?.status ?? null);
</script>

<article class="catalog-row" aria-labelledby="app-{applicationId}-name">
  <ApplicationIcon {application} />
  <div class="catalog-row__content">
    <a class="catalog-row__link" href={detailHref}>
      <div class="catalog-row__text">
        <h2 id="app-{applicationId}-name">{application.name}</h2>
        <p>{application.description}</p>
      </div>
    </a>
    <div class="catalog-row__status">
      <StatusBadge status={badgeStatus} />
      <DependencySummary {application} {applicationStatus} />
    </div>
  </div>
</article>

<style>
  .catalog-row {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .catalog-row__content {
    flex: 1;
    min-width: 0;
  }

  .catalog-row__link {
    color: inherit;
    text-decoration: none;
  }

  .catalog-row__status {
    margin-top: 0.5rem;
  }

  .catalog-row__link:hover .catalog-row__text h2,
  .catalog-row__link:focus-visible .catalog-row__text h2 {
    text-decoration: underline;
  }

  .catalog-row__text h2 {
    font-size: 1.125rem;
    margin: 0 0 0.25rem;
  }

  .catalog-row__text p {
    margin: 0;
    color: #444;
  }
</style>
