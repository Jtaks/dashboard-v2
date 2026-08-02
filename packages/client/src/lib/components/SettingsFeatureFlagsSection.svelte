<script lang="ts">
  import type { Session } from '@dashboard/shared';

  import SettingsSection from '$lib/components/SettingsSection.svelte';
  import { resolveFlagDescription } from '$lib/flags/descriptions.js';
  import { featureFlagRegistry } from '$lib/flags/registry.js';
  import { flagsStore } from '$lib/flags/store.js';
  import { resolveFlag } from '$lib/flags/storage.js';
  import { visibleFeatureFlags } from '$lib/flags/visible-flags.js';
  import * as m from '$lib/paraglide/messages';

  let { session }: { session: Session | null | undefined } = $props();

  const visibleFlags = $derived(visibleFeatureFlags(featureFlagRegistry, session?.admin === true));

  function createFlagChangeHandler(feature: string) {
    return (event: Event) => {
      const target = event.currentTarget as HTMLInputElement;
      flagsStore.setFlag(feature, target.checked);
    };
  }

  function createFlagKeydownHandler(feature: string) {
    return (event: KeyboardEvent) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      const target = event.currentTarget as HTMLInputElement;
      flagsStore.setFlag(feature, !target.checked);
    };
  }
</script>

<SettingsSection
  headingId="settings-feature-flags-heading"
  heading={m.settings_feature_flags_section_title()}
  testId="settings-feature-flags-section"
>
  {#each visibleFlags as flag (flag.feature)}
    {@const inputId = `feature-flag-${flag.feature}`}
    {@const description = resolveFlagDescription(flag.description)}
    <div class="feature-flag">
      <input
        type="checkbox"
        id={inputId}
        class="feature-flag__control"
        checked={resolveFlag($flagsStore, flag.feature)}
        data-testid={`feature-flag-${flag.feature}`}
        onchange={createFlagChangeHandler(flag.feature)}
        onkeydown={createFlagKeydownHandler(flag.feature)}
      />
      <label class="feature-flag__label" for={inputId}>{description}</label>
    </div>
  {/each}
</SettingsSection>

<style>
  .feature-flag {
    align-items: flex-start;
    display: grid;
    gap: 0.5rem;
    grid-template-columns: auto 1fr;
  }

  .feature-flag__control {
    margin-top: 0.125rem;
  }

  .feature-flag__label {
    line-height: 1.4;
  }
</style>
