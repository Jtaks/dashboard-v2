<script lang="ts">
  import type { Service } from '@dashboard/shared';
  import { useServiceStatus } from '$lib/status/accessor.js';
  import { formatUptime } from '$lib/status/duration.js';

  import StatusBadge from './StatusBadge.svelte';

  let {
    applicationId,
    service,
  }: {
    applicationId: string;
    service: Service;
  } = $props();

  const statusState = $derived.by(() => useServiceStatus(applicationId, service.id));
  const serviceStatus = $derived(statusState.status);
  const badgeStatus = $derived(serviceStatus?.status ?? null);
  const now = $derived(
    statusState.collectedAt ? new Date(statusState.collectedAt) : new Date(),
  );
  const uptime = $derived(
    service.hasContainers ? formatUptime(serviceStatus?.since ?? null, now) : null,
  );
</script>

<li class="service-list__row">
  <button type="button" class="service-list__button">
    <span class="service-list__name">{service.name}</span>
    {#if service.hasContainers}
      <span class="service-list__status">
        <StatusBadge status={badgeStatus} />
        {#if uptime}
          <span class="service-list__uptime">{uptime}</span>
        {/if}
      </span>
    {/if}
  </button>
</li>

<style>
  .service-list__row {
    list-style: none;
  }

  .service-list__button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #eee;
    border-radius: 0.375rem;
    background: #fff;
    font: inherit;
    text-align: left;
    cursor: default;
  }

  .service-list__button:focus-visible {
    border-color: #1565c0;
    box-shadow: 0 0 0 2px rgba(21, 101, 192, 0.2);
    outline: none;
  }

  .service-list__name {
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .service-list__status {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .service-list__uptime {
    font-size: 0.8125rem;
    color: #555;
  }
</style>
