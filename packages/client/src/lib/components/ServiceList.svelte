<script lang="ts">
  import type { Application } from '@dashboard/shared';
  import * as m from '$lib/paraglide/messages';

  import ServiceStatusRow from './ServiceStatusRow.svelte';

  let {
    application,
    applicationId,
  }: {
    application: Application;
    applicationId: string;
  } = $props();
</script>

<ul class="service-list" aria-label={m.app_detail_service_list_label()}>
  {#each application.services as service (service.id)}
    <ServiceStatusRow {applicationId} {service} />
  {/each}
</ul>

<style>
  .service-list {
    list-style: none;
    margin: 1rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
</style>
