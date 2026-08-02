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

  let open = $state(false);

  const services = $derived(
    joinServicesWithStatus(application.services, applicationStatus?.services ?? []),
  );
  const popoverId = $derived(`dependency-popover-${application.id}`);

  function showPopover() {
    open = true;
  }

  function hidePopover() {
    open = false;
  }
</script>

<div
  class="dependency-summary dependency-summary--popover"
  role="group"
  onmouseenter={showPopover}
  onmouseleave={hidePopover}
  onfocusin={showPopover}
  onfocusout={hidePopover}
>
  <div
    class="dependency-summary__trigger"
    tabindex="0"
    role="button"
    aria-haspopup="true"
    aria-expanded={open}
    aria-controls={popoverId}
  >
    <span class="dependency-summary__trigger-label">{m.dependency_summary_popover_trigger()}</span>
    <StatusCountList {counts} />
  </div>

  {#if open}
    <div id={popoverId} class="dependency-summary__popover" role="region" aria-label={m.dependency_summary_heading()}>
      <p class="dependency-summary__popover-heading">{m.dependency_summary_heading()}</p>
      <ul class="dependency-summary__breakdown">
        {#each services as service (service.id)}
          <li class="dependency-summary__service">
            <span class="dependency-summary__service-name">{service.name}</span>
            <StatusBadge status={service.status} />
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .dependency-summary--popover {
    position: relative;
    margin-top: 0.5rem;
  }

  .dependency-summary__trigger {
    display: grid;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid #ddd;
    border-radius: 0.375rem;
    background: #fafafa;
    cursor: default;
  }

  .dependency-summary__trigger:focus-visible {
    outline: 2px solid #1a237e;
    outline-offset: 2px;
  }

  .dependency-summary__trigger-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #333;
  }

  .dependency-summary__popover {
    position: absolute;
    z-index: 10;
    top: calc(100% + 0.25rem);
    left: 0;
    min-width: min(100%, 16rem);
    padding: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 0.375rem;
    background: #fff;
    box-shadow: 0 0.25rem 0.75rem rgb(0 0 0 / 0.12);
  }

  .dependency-summary__popover-heading {
    margin: 0 0 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #333;
  }

  .dependency-summary__breakdown {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.375rem;
  }

  .dependency-summary__service {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .dependency-summary__service-name {
    font-size: 0.875rem;
  }
</style>
