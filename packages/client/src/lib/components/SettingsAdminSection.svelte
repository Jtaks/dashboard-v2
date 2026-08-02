<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';

  import { fetchAdminTopics } from '$lib/api/admin.js';
  import { ApiError } from '$lib/api/client.js';
  import * as m from '$lib/paraglide/messages';

  import Refusal from './Refusal.svelte';
  import SettingsSection from './SettingsSection.svelte';

  const adminQuery = createQuery(() => ({
    queryKey: ['admin', 'topics'],
    queryFn: fetchAdminTopics,
    retry: false,
  }));

  const showRefusal = $derived(
    adminQuery.error instanceof ApiError && adminQuery.error.isForbidden,
  );
</script>

{#if showRefusal}
  <Refusal />
{:else}
  <SettingsSection
    headingId="settings-admin-heading"
    heading={m.settings_admin_section_title()}
    testId="settings-admin-section"
  >
    {#if adminQuery.isPending}
      <p aria-busy="true"></p>
    {:else if adminQuery.isSuccess}
      <p>{m.settings_admin_section_description()}</p>
    {/if}
  </SettingsSection>
{/if}
