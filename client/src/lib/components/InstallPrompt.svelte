<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';

  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };

  let deferred = $state<BeforeInstallPromptEvent | null>(null);
  let visible = $state(false);
  let busy = $state(false);

  $effect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      deferred = event as BeforeInstallPromptEvent;
      visible = true;
    }

    function onAppInstalled() {
      deferred = null;
      visible = false;
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  });

  async function accept() {
    if (!deferred || busy) {
      return;
    }
    busy = true;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      deferred = null;
      visible = false;
      busy = false;
    }
  }

  function dismiss() {
    if (busy) {
      return;
    }
    visible = false;
  }
</script>

{#if visible && deferred}
  <aside
    class="install-prompt"
    data-testid="install-prompt"
    role="region"
    aria-label={m.install_prompt_region()}
  >
    <div class="install-prompt-copy">
      <h2 class="install-prompt-title" data-testid="install-prompt-title">
        {m.install_prompt_title()}
      </h2>
      <p class="install-prompt-body" data-testid="install-prompt-body">
        {m.install_prompt_body()}
      </p>
    </div>
    <div class="install-prompt-actions">
      <button
        type="button"
        class="install-prompt-dismiss"
        data-testid="install-prompt-dismiss"
        disabled={busy}
        onclick={dismiss}
      >
        {m.install_prompt_dismiss()}
      </button>
      <button
        type="button"
        class="install-prompt-accept"
        data-testid="install-prompt-accept"
        disabled={busy}
        onclick={() => void accept()}
      >
        {m.install_prompt_accept()}
      </button>
    </div>
  </aside>
{/if}

<style>
  .install-prompt {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    background: color-mix(in srgb, currentColor 6%, transparent);
  }

  .install-prompt-copy {
    min-width: 0;
    flex: 1 1 12rem;
  }

  .install-prompt-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 650;
    line-height: 1.3;
  }

  .install-prompt-body {
    margin: 0.35rem 0 0;
    font-size: 0.925rem;
    line-height: 1.4;
  }

  .install-prompt-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    flex: 0 0 auto;
  }

  .install-prompt-dismiss,
  .install-prompt-accept {
    padding: 0.35rem 0.65rem;
    border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
    background: color-mix(in srgb, currentColor 8%, transparent);
    color: inherit;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .install-prompt-accept {
    font-weight: 650;
  }

  .install-prompt-dismiss:focus-visible,
  .install-prompt-accept:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .install-prompt-dismiss:disabled,
  .install-prompt-accept:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
