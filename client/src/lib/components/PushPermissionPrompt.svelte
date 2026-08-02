<script lang="ts">
  import { dismissPushPrompt } from '$lib/push/prompt-storage.js';
  import { resolvePushOnLoad, setPushSubscriptionState } from '$lib/push/state.js';
  import { subscribeToPush } from '$lib/push/subscribe.js';
  import { m } from '$lib/paraglide/messages.js';

  let visible = $state(false);
  let busy = $state(false);

  $effect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const action = await resolvePushOnLoad();
        if (!cancelled && action === 'prompt') {
          visible = true;
        }
      } catch {
        // Upsert or registration failures must not break the shell.
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  async function accept() {
    if (busy) {
      return;
    }
    busy = true;
    try {
      const subscription = await subscribeToPush();
      setPushSubscriptionState(subscription);
      visible = false;
    } catch {
      // Permission denied or subscribe failure: hide; denied cannot be undone in-page.
      visible = false;
    } finally {
      busy = false;
    }
  }

  function decline() {
    if (busy) {
      return;
    }
    dismissPushPrompt();
    visible = false;
  }
</script>

{#if visible}
  <aside
    class="push-prompt"
    data-testid="push-prompt"
    role="region"
    aria-label={m.push_prompt_region()}
  >
    <div class="push-prompt-copy">
      <h2 class="push-prompt-title" data-testid="push-prompt-title">{m.push_prompt_title()}</h2>
      <p class="push-prompt-body" data-testid="push-prompt-body">{m.push_prompt_body()}</p>
    </div>
    <div class="push-prompt-actions">
      <button
        type="button"
        class="push-prompt-decline"
        data-testid="push-prompt-decline"
        disabled={busy}
        onclick={decline}
      >
        {m.push_prompt_decline()}
      </button>
      <button
        type="button"
        class="push-prompt-accept"
        data-testid="push-prompt-accept"
        disabled={busy}
        onclick={() => void accept()}
      >
        {m.push_prompt_accept()}
      </button>
    </div>
  </aside>
{/if}

<style>
  .push-prompt {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    background: color-mix(in srgb, currentColor 6%, transparent);
  }

  .push-prompt-copy {
    min-width: 0;
    flex: 1 1 12rem;
  }

  .push-prompt-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 650;
    line-height: 1.3;
  }

  .push-prompt-body {
    margin: 0.35rem 0 0;
    font-size: 0.925rem;
    line-height: 1.4;
  }

  .push-prompt-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    flex: 0 0 auto;
  }

  .push-prompt-decline,
  .push-prompt-accept {
    padding: 0.35rem 0.65rem;
    border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
    background: color-mix(in srgb, currentColor 8%, transparent);
    color: inherit;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .push-prompt-accept {
    font-weight: 650;
  }

  .push-prompt-decline:focus-visible,
  .push-prompt-accept:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .push-prompt-decline:disabled,
  .push-prompt-accept:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
