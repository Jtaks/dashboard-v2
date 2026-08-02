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

<article class="catalog-tile" aria-labelledby="tile-{applicationId}-name">
  <ApplicationIcon {application} />
  <a class="catalog-tile__link" href={detailHref}>
    <div class="catalog-tile__text">
      <h2 id="tile-{applicationId}-name">{application.name}</h2>
      <p>{application.description}</p>
    </div>
  </a>
  <div class="catalog-tile__status">
    <StatusBadge status={badgeStatus} />
    <DependencySummary {application} {applicationStatus} />
  </div>
</article>

<style>
  .catalog-tile {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 0.5rem;
    background: #fff;
  }

  .catalog-tile__link {
    color: inherit;
    text-decoration: none;
  }

  .catalog-tile__link:hover .catalog-tile__text h2,
  .catalog-tile__link:focus-visible .catalog-tile__text h2 {
    text-decoration: underline;
  }

  .catalog-tile__text h2 {
    font-size: 1.125rem;
    margin: 0 0 0.25rem;
  }

  .catalog-tile__text p {
    margin: 0;
    color: #444;
  }

  .catalog-tile__status {
    margin-top: 0.25rem;
  }
</style>
