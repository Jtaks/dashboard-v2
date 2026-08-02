<script lang="ts">
  import type { Session } from '@dashboard/shared';
  import { FEATURE_FLAGS, featureFlags, setFeatureFlag, visibleFlags } from '$lib/flags/index.js';
  import { resolveFlagDescription } from '$lib/flags/messages.js';
  import { m } from '$lib/paraglide/messages.js';

  let {
    session,
  }: {
    session: Pick<Session, 'admin'> | undefined;
  } = $props();

  const listed = $derived(visibleFlags(FEATURE_FLAGS, session?.admin === true));
  // Subscribe so toggles re-render listed switches and the reactivity probe.
  const flagValues = $derived($featureFlags);
</script>

{#if listed.length === 0}
  <p data-testid="settings-flags-empty">{m.settings_flags_empty()}</p>
{:else}
  <ul class="flag-list" data-testid="settings-flags-list">
    {#each listed as flag (flag.feature)}
      {@const enabled = flagValues[flag.feature] === true}
      {@const labelId = `flag-label-${flag.feature}`}
      {@const description = resolveFlagDescription(flag)}
      <li class="flag-row" data-testid="settings-flag-{flag.feature}">
        <div class="flag-copy">
          <span id={labelId} class="flag-label">{description}</span>
        </div>
        <button
          type="button"
          class="flag-toggle"
          role="switch"
          aria-checked={enabled}
          aria-labelledby={labelId}
          data-testid="settings-flag-toggle-{flag.feature}"
          onclick={() => setFeatureFlag(flag.feature, !enabled)}
        >
          <span class="flag-toggle-track" aria-hidden="true">
            <span class="flag-toggle-thumb"></span>
          </span>
          <span class="visually-hidden">
            {enabled ? m.settings_flag_on() : m.settings_flag_off()}
          </span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<!--
  Reactivity probe for Playwright / C4 consumers: reflects live store value without implementing C4.
-->
<div
  data-testid="flag-status-summary-popover-state"
  data-enabled={flagValues['status-summary-popover'] === true ? 'true' : 'false'}
  hidden
></div>

<style>
  .flag-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .flag-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    min-width: 0;
  }

  .flag-copy {
    min-width: 0;
    flex: 1;
  }

  .flag-label {
    display: block;
    line-height: 1.4;
  }

  .flag-toggle {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .flag-toggle-track {
    display: inline-flex;
    align-items: center;
    width: 2.5rem;
    height: 1.35rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    background: color-mix(in srgb, currentColor 8%, transparent);
    padding: 0.1rem;
    box-sizing: border-box;
    transition: background 0.15s ease;
  }

  .flag-toggle[aria-checked='true'] .flag-toggle-track {
    background: color-mix(in srgb, currentColor 22%, transparent);
  }

  .flag-toggle-thumb {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: currentColor;
    transform: translateX(0);
    transition: transform 0.15s ease;
  }

  .flag-toggle[aria-checked='true'] .flag-toggle-thumb {
    transform: translateX(1.05rem);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
