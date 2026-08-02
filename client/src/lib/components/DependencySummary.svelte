<script lang="ts">
  import type { Application, ApplicationStatus, Status } from '@dashboard/shared';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { STATUS_SUMMARY_POPOVER, featureFlags } from '$lib/flags/index.js';
  import { m } from '$lib/paraglide/messages.js';
  import { countServicesByStatus, statusCountEntries } from '$lib/status/counts.js';
  import { statusKeyLabel } from '$lib/status/labels.js';

  let {
    application,
    applicationStatus,
  }: {
    application: Application;
    applicationStatus: ApplicationStatus | null;
  } = $props();

  let expanded = $state(false);

  const usePopover = $derived($featureFlags[STATUS_SUMMARY_POPOVER] === true);

  const services = $derived(
    application.services.map((service) => {
      const reading = applicationStatus?.services.find((entry) => entry.id === service.id);
      return {
        id: service.id,
        name: service.name,
        status: (reading?.status ?? null) as Status | null,
      };
    }),
  );

  const counts = $derived(
    countServicesByStatus(
      services.map((service) => ({
        id: service.id,
        status: service.status,
        since: null,
      })),
    ),
  );

  const countEntries = $derived(statusCountEntries(counts));
  const panelId = $derived(`status-summary-panel-${application.id}`);

  // Flag on → popover only; leave expander closed so state does not leak across modes.
  $effect(() => {
    if (usePopover) {
      expanded = false;
    }
  });

  function toggleExpanded() {
    expanded = !expanded;
  }
</script>

{#if application.services.length > 0}
  <div class="status-summary" data-testid="status-summary" data-app-id={application.id}>
    {#if usePopover}
      <div
        class="summary-popover-wrap"
        data-testid="status-summary-popover"
        aria-label={m.status_summary_label()}
      >
        <div class="summary-trigger" data-testid="status-summary-trigger">
          <span class="summary-label">{m.status_summary_label()}</span>
          <span class="summary-counts">
            {#each countEntries as entry (entry.key)}
              <span class="summary-count" data-status={entry.key}>
                {m.status_summary_count({
                  count: entry.count,
                  label: statusKeyLabel(entry.key),
                })}
              </span>
            {/each}
          </span>
        </div>
        <div class="summary-popover" role="tooltip" data-testid="status-summary-panel" id={panelId}>
          <ul class="service-list">
            {#each services as service (service.id)}
              <li
                class="service-row"
                data-testid="status-summary-service"
                data-service-id={service.id}
              >
                <span class="service-name">{service.name}</span>
                <StatusBadge status={service.status} />
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {:else}
      <button
        type="button"
        class="summary-expander"
        data-testid="status-summary-expander"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={expanded ? m.status_summary_collapse() : m.status_summary_expand()}
        onclick={toggleExpanded}
      >
        <span class="summary-label">{m.status_summary_label()}</span>
        <span class="summary-counts">
          {#each countEntries as entry (entry.key)}
            <span class="summary-count" data-status={entry.key}>
              {m.status_summary_count({
                count: entry.count,
                label: statusKeyLabel(entry.key),
              })}
            </span>
          {/each}
        </span>
      </button>
      {#if expanded}
        <div class="summary-panel" data-testid="status-summary-panel" id={panelId}>
          <ul class="service-list">
            {#each services as service (service.id)}
              <li
                class="service-row"
                data-testid="status-summary-service"
                data-service-id={service.id}
              >
                <span class="service-name">{service.name}</span>
                <StatusBadge status={service.status} />
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .status-summary {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
    min-width: 0;
  }

  .summary-expander,
  .summary-trigger {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    max-width: 100%;
    padding: 0.25rem 0.45rem;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .summary-trigger {
    cursor: default;
  }

  .summary-label {
    font-weight: 600;
    font-size: 0.8rem;
  }

  .summary-counts {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    font-size: 0.8rem;
  }

  .summary-count {
    white-space: nowrap;
  }

  .summary-panel {
    width: 100%;
  }

  .summary-popover-wrap {
    position: relative;
    display: inline-flex;
    max-width: 100%;
  }

  .summary-popover {
    display: none;
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
    z-index: 2;
    min-width: 12rem;
    max-width: min(20rem, 80vw);
    padding: 0.5rem;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    background: Canvas;
    color: CanvasText;
    box-shadow: 0 0.35rem 0.75rem color-mix(in srgb, CanvasText 12%, transparent);
  }

  .summary-popover-wrap:hover .summary-popover,
  .summary-popover-wrap:focus-within .summary-popover {
    display: block;
  }

  .service-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .service-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .service-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
