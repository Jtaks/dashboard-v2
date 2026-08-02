<script lang="ts">
  import type { Status } from '@dashboard/shared';
  import { STATUS_ORDER } from '@dashboard/shared';
  import * as m from '$lib/paraglide/messages';
  import type { StatusCounts } from '$lib/status/counts.js';

  import StatusBadge from './StatusBadge.svelte';

  let { counts }: { counts: StatusCounts } = $props();

  const visibleStatuses = $derived(
    STATUS_ORDER.filter((status) => counts[status] > 0),
  );

  function countLabel(status: Status, count: number): string {
    switch (status) {
      case 'up':
        return m.dependency_summary_count_up({ count });
      case 'starting':
        return m.dependency_summary_count_starting({ count });
      case 'degraded':
        return m.dependency_summary_count_degraded({ count });
      case 'down':
        return m.dependency_summary_count_down({ count });
      case 'unknown':
        return m.dependency_summary_count_unknown({ count });
    }
  }
</script>

<ul class="status-count-list" aria-label={m.dependency_summary_counts_label()}>
  {#each visibleStatuses as status (status)}
    <li class="status-count-list__item">
      <StatusBadge {status} />
      <span class="status-count-list__count">{countLabel(status, counts[status])}</span>
    </li>
  {/each}
</ul>

<style>
  .status-count-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .status-count-list__item {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .status-count-list__count {
    font-size: 0.8125rem;
    color: #444;
  }
</style>
