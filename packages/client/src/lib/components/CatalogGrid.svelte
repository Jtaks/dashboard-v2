<script lang="ts">
  import type { Application } from '@dashboard/shared';

  import ApplicationTile from './ApplicationTile.svelte';

  let { applications }: { applications: Application[] } = $props();
</script>

<ul class="catalog-grid">
  {#each applications as application (application.id)}
    <li>
      <ApplicationTile {application} applicationId={application.id} />
    </li>
  {/each}
</ul>

<style>
  .catalog-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  }

  @media (max-width: 30rem) {
    .catalog-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
