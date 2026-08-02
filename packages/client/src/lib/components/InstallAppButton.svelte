<script lang="ts">
  import { browser } from '$app/environment';
  import * as m from '$lib/paraglide/messages';
  import {
    captureBeforeInstallPrompt,
    promptInstall,
    subscribeInstallAvailability,
  } from '$lib/pwa/install.js';

  let showInstall = $state(false);
  let isInstalling = $state(false);

  $effect(() => {
    if (!browser) {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      captureBeforeInstallPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    const unsubscribe = subscribeInstallAvailability((available) => {
      showInstall = available;
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      unsubscribe();
    };
  });

  async function handleInstall() {
    if (isInstalling) {
      return;
    }

    isInstalling = true;

    try {
      await promptInstall();
    } finally {
      isInstalling = false;
    }
  }
</script>

{#if showInstall}
  <button
    type="button"
    class="install-app"
    data-testid="install-app-button"
    disabled={isInstalling}
    onclick={handleInstall}
  >
    {m.pwa_install_button()}
  </button>
{/if}

<style>
  .install-app {
    background: transparent;
    border: 1px solid currentColor;
    border-radius: 0.375rem;
    cursor: pointer;
    font: inherit;
    min-height: 2.25rem;
    padding: 0.375rem 0.75rem;
  }

  .install-app:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .install-app:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
</style>
