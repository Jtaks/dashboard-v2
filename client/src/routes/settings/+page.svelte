<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import type { Session } from '@dashboard/shared';
  import { fetchSession, sessionQueryKey } from '$lib/auth/session.js';
  import SettingsAdminSection from '$lib/components/SettingsAdminSection.svelte';
  import SettingsFlagsSection from '$lib/components/SettingsFlagsSection.svelte';
  import SettingsSection from '$lib/components/SettingsSection.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { shouldShowAdminSection } from '$lib/settings/admin.js';

  // Shares the AppShell session cache — visibility still derives from that response alone.
  const sessionQuery = createQuery(() => ({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    retry: false,
  }));

  const session = $derived(sessionQuery.data as Session | undefined);
  const showAdmin = $derived(session ? shouldShowAdminSection(session) : false);
</script>

<main data-testid="settings-page" class="settings-page">
  <h1>{m.settings_title()}</h1>

  <div class="settings-sections">
    <!-- F5 mounts notification subscription controls into this section. -->
    <SettingsSection id="notifications" heading={m.settings_section_notifications()} />

    <SettingsSection id="flags" heading={m.settings_section_flags()}>
      <SettingsFlagsSection {session} />
    </SettingsSection>

    {#if showAdmin}
      <SettingsAdminSection />
    {/if}
  </div>
</main>

<style>
  .settings-page {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 1rem;
    overflow-x: hidden;
  }

  .settings-page h1 {
    margin: 0 0 1.25rem;
    font-size: 1.5rem;
  }

  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-width: 0;
    max-width: 100%;
  }
</style>
