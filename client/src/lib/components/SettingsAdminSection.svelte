<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { ForbiddenError } from '$lib/api/client.js';
  import Forbidden from '$lib/components/Forbidden.svelte';
  import SettingsSection from '$lib/components/SettingsSection.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { adminTopicsQueryOptions } from '$lib/settings/admin-topics.js';

  const topicsQuery = createQuery(() => adminTopicsQueryOptions());

  const forbidden = $derived(
    topicsQuery.error instanceof ForbiddenError ? topicsQuery.error : null,
  );
</script>

<SettingsSection id="admin" heading={m.settings_section_admin()}>
  {#if forbidden}
    <Forbidden code={forbidden.code} />
  {:else if topicsQuery.isPending}
    <div data-testid="settings-admin-loading" role="status"></div>
  {:else if topicsQuery.isError}
    <div data-testid="settings-admin-error" role="alert"></div>
  {:else}
    <!-- Reserved for epic E admin settings; probe succeeded. -->
    <div data-testid="settings-admin-ready"></div>
  {/if}
</SettingsSection>
