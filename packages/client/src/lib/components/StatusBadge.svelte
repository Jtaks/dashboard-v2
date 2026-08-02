<script lang="ts">
  import type { Status } from '@dashboard/shared';
  import {
    AlertTriangle,
    CircleCheck,
    CircleDashed,
    CircleHelp,
    CircleX,
  } from '@lucide/svelte';

  import { statusAccessibleName } from '$lib/status/label.js';

  let { status }: { status: Status | null } = $props();

  const accessibleName = $derived(statusAccessibleName(status));
</script>

{#if status !== null && accessibleName !== null}
  <span class="status-badge status-badge--{status}" aria-label={accessibleName}>
    {#if status === 'up'}
      <CircleCheck aria-hidden="true" size={16} strokeWidth={2.25} />
    {:else if status === 'starting'}
      <CircleDashed aria-hidden="true" size={16} strokeWidth={2.25} />
    {:else if status === 'degraded'}
      <AlertTriangle aria-hidden="true" size={16} strokeWidth={2.25} />
    {:else if status === 'down'}
      <CircleX aria-hidden="true" size={16} strokeWidth={2.25} />
    {:else}
      <CircleHelp aria-hidden="true" size={16} strokeWidth={2.25} />
    {/if}
    <span class="status-badge__label" aria-hidden="true">{accessibleName}</span>
  </span>
{/if}

<style>
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.2;
    border: 1px solid transparent;
  }

  .status-badge__label {
    text-transform: capitalize;
  }

  .status-badge--up {
    color: var(--status-up-badge-fg);
    background: var(--status-up-badge-bg);
    border-color: var(--status-up-badge-border);
  }

  .status-badge--starting {
    color: var(--status-starting-badge-fg);
    background: var(--status-starting-badge-bg);
    border-color: var(--status-starting-badge-border);
  }

  .status-badge--degraded {
    color: var(--status-degraded-badge-fg);
    background: var(--status-degraded-badge-bg);
    border-color: var(--status-degraded-badge-border);
  }

  .status-badge--down {
    color: var(--status-down-badge-fg);
    background: var(--status-down-badge-bg);
    border-color: var(--status-down-badge-border);
  }

  .status-badge--unknown {
    color: var(--status-unknown-badge-fg);
    background: var(--status-unknown-badge-bg);
    border-color: var(--status-unknown-badge-border);
  }
</style>
