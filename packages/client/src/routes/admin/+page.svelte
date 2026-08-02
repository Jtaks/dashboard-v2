<script lang="ts">
  import AdminAlertsSection from '$lib/components/AdminAlertsSection.svelte';
  import AdminPushSection from '$lib/components/AdminPushSection.svelte';
  import * as m from '$lib/paraglide/messages';
</script>

<main class="admin-page">
  <h1>{m.page_admin_title()}</h1>
  <AdminAlertsSection />
  <AdminPushSection />
</main>

<style>
  .admin-page {
    box-sizing: border-box;
    max-width: 64rem;
    width: 100%;
  }

  .admin-page h1 {
    font-size: 1.5rem;
    margin: 0 0 1.5rem;
  }

  .admin-page > :global(* + *) {
    margin-top: 2rem;
  }
</style>
