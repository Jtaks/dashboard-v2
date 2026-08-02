<script lang="ts">
  import type { Status } from '@dashboard/shared';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleDashed from '@lucide/svelte/icons/circle-dashed';
  import CircleHelp from '@lucide/svelte/icons/circle-help';
  import CircleX from '@lucide/svelte/icons/circle-x';
  import { statusAccessibleName } from '$lib/status/labels.js';

  let {
    status,
  }: {
    /** Application or service status. `null` renders nothing. */
    status: Status | null;
  } = $props();

  const label = $derived(status === null ? null : statusAccessibleName(status));
</script>

{#if status !== null && label !== null}
  <span class="status-badge status-{status}" data-testid="status-badge" data-status={status}>
    {#if status === 'up'}
      <CircleCheck aria-hidden="true" size={14} class="status-badge-icon" />
    {:else if status === 'starting'}
      <CircleDashed aria-hidden="true" size={14} class="status-badge-icon" />
    {:else if status === 'degraded'}
      <CircleAlert aria-hidden="true" size={14} class="status-badge-icon" />
    {:else if status === 'down'}
      <CircleX aria-hidden="true" size={14} class="status-badge-icon" />
    {:else}
      <CircleHelp aria-hidden="true" size={14} class="status-badge-icon" />
    {/if}
    <span class="status-badge-label">{label}</span>
  </span>
{/if}

<style>
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.15rem 0.45rem;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    font-size: 0.8rem;
    line-height: 1.2;
    white-space: nowrap;
  }

  .status-badge :global(.status-badge-icon) {
    flex-shrink: 0;
  }

  .status-badge-label {
    font-weight: 600;
  }

  .status-up {
    color: var(--status-up);
    background: color-mix(in srgb, var(--status-up) var(--status-tint), transparent);
  }

  .status-starting {
    color: var(--status-starting);
    background: color-mix(in srgb, var(--status-starting) var(--status-tint), transparent);
  }

  .status-degraded {
    color: var(--status-degraded);
    background: color-mix(in srgb, var(--status-degraded) var(--status-tint), transparent);
  }

  .status-down {
    color: var(--status-down);
    background: color-mix(in srgb, var(--status-down) var(--status-tint), transparent);
  }

  .status-unknown {
    color: var(--status-unknown);
    background: color-mix(in srgb, var(--status-unknown) var(--status-tint), transparent);
  }
</style>
