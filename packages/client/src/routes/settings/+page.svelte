<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';

  import { fetchSession } from '$lib/api/session.js';
  import SettingsAdminSection from '$lib/components/SettingsAdminSection.svelte';
  import SettingsFeatureFlagsSection from '$lib/components/SettingsFeatureFlagsSection.svelte';
  import SettingsPushSubscriptionSection from '$lib/components/SettingsPushSubscriptionSection.svelte';
  import * as m from '$lib/paraglide/messages';
  import { shouldShowAdminSection } from '$lib/settings/show-admin-section.js';

  const sessionQuery = createQuery(() => ({
    queryKey: ['session'],
    queryFn: fetchSession,
    retry: false,
  }));

  const showAdminSection = $derived(shouldShowAdminSection(sessionQuery.data));
</script>

<main class="settings">
  <h1>{m.page_settings_title()}</h1>

  <SettingsFeatureFlagsSection session={sessionQuery.data} />

  <SettingsPushSubscriptionSection />

  {#if showAdminSection}
    <SettingsAdminSection />
  {/if}
</main>

<style>
  .settings {
    box-sizing: border-box;
    max-width: 40rem;
    width: 100%;
  }

  .settings h1 {
    font-size: 1.5rem;
    margin: 0 0 1.5rem;
  }
</style>
