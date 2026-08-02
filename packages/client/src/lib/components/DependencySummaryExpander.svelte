<script lang="ts">
  import type { Application, ApplicationStatus } from '@dashboard/shared';
  import * as m from '$lib/paraglide/messages';
  import type { StatusCounts } from '$lib/status/counts.js';
  import { joinServicesWithStatus } from '$lib/status/services.js';

  import StatusBadge from './StatusBadge.svelte';
  import StatusCountList from './StatusCountList.svelte';

  let {
    application,
    applicationStatus,
    counts,
  }: {
    application: Application;
    applicationStatus: ApplicationStatus | null;
    counts: StatusCounts;
  } = $props();

  let expanded = $state(false);

  const services = $derived(
    joinServicesWithStatus(application.services, applicationStatus?.services ?? []),
  );
  const panelId = $derived(`dependency-summary-${application.id}`);
  const toggleLabel = $derived(
    expanded ? m.dependency_summary_collapse() : m.dependency_summary_expand(),
  );

  function toggleExpanded() {
    expanded = !expanded;
  }
</script>

<div class="dependency-summary dependency-summary--expander">
  <button
    type="button"
    class="dependency-summary__toggle"
    aria-expanded={expanded}
    aria-controls={panelId}
    onclick={toggleExpanded}
  >
    <span class="dependency-summary__toggle-label">{toggleLabel}</span>
    <StatusCountList {counts} />
  </button>

  {#if expanded}
    <ul id={panelId} class="dependency-summary__breakdown">
      {#each services as service (service.id)}
        <li class="dependency-summary__service">
          <span class="dependency-summary__service-name">{service.name}</span>
          <StatusBadge status={service.status} />
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .dependency-summary {
    margin-top: 0.5rem;
  }

  .dependency-summary__toggle {
    display: grid;
    gap: 0.375rem;
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: 1px solid #ddd;
    border-radius: 0.375rem;
    background: #fafafa;
    text-align: left;
    font: inherit;
    cursor: pointer;
  }

  .dependency-summary__toggle:hover,
  .dependency-summary__toggle:focus-visible {
    border-color: #999;
    background: #f5f5f5;
  }

  .dependency-summary__toggle-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #333;
  }

  .dependency-summary__breakdown {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.375rem;
  }

  .dependency-summary__service {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.375rem 0.625rem;
    border: 1px solid #eee;
    border-radius: 0.375rem;
    background: #fff;
  }

  .dependency-summary__service-name {
    font-size: 0.875rem;
  }
</style>
