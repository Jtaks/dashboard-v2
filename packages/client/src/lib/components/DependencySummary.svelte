<script lang="ts">
  import type { Application, ApplicationStatus } from '@dashboard/shared';
  import { DEPENDENCY_SUMMARY_POPOVER_FLAG } from '$lib/flags/registry.js';
  import { useFeatureFlag } from '$lib/flags/useFeatureFlag.js';
  import { countServicesByStatus } from '$lib/status/counts.js';

  import DependencySummaryExpander from './DependencySummaryExpander.svelte';
  import DependencySummaryPopover from './DependencySummaryPopover.svelte';

  let {
    application,
    applicationStatus,
  }: {
    application: Application;
    applicationStatus: ApplicationStatus | null;
  } = $props();

  const popoverEnabled = useFeatureFlag(DEPENDENCY_SUMMARY_POPOVER_FLAG);

  const counts = $derived(countServicesByStatus(applicationStatus?.services ?? []));
  const hasCountableServices = $derived(Object.values(counts).some((count) => count > 0));
</script>

{#if hasCountableServices}
  {#if $popoverEnabled}
    <DependencySummaryPopover {application} {applicationStatus} {counts} />
  {:else}
    <DependencySummaryExpander {application} {applicationStatus} {counts} />
  {/if}
{/if}
