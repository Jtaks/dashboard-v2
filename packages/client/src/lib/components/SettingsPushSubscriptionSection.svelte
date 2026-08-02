<script lang="ts">
  import SettingsSection from '$lib/components/SettingsSection.svelte';
  import { shouldShowIosPushNotice } from '$lib/push/ios.js';
  import {
    loadPushSettingsState,
    type PushSubscriptionStatus,
  } from '$lib/push/settings-state.js';
  import { subscribeToPush } from '$lib/push/subscribe.js';
  import { unsubscribeFromPush } from '$lib/push/unsubscribe.js';
  import * as m from '$lib/paraglide/messages';

  let status = $state<PushSubscriptionStatus | null>(null);
  let registration = $state<ServiceWorkerRegistration | null>(null);
  let isLoading = $state(true);
  let isActing = $state(false);

  const showIosNotice = $derived(shouldShowIosPushNotice());

  async function refreshState() {
    isLoading = true;

    const state = await loadPushSettingsState();
    status = state?.status ?? null;
    registration = state?.registration ?? null;
    isLoading = false;
  }

  $effect(() => {
    void refreshState();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });

  async function handleSubscribe() {
    if (!registration || isActing) {
      return;
    }

    isActing = true;

    try {
      await subscribeToPush(registration);
      await refreshState();
    } finally {
      isActing = false;
    }
  }

  async function handleUnsubscribe() {
    if (!registration || isActing) {
      return;
    }

    isActing = true;

    try {
      await unsubscribeFromPush(registration);
      await refreshState();
    } finally {
      isActing = false;
    }
  }

  function statusMessage(currentStatus: PushSubscriptionStatus): string {
    switch (currentStatus) {
      case 'subscribed':
        return m.settings_push_status_subscribed();
      case 'not_subscribed':
        return m.settings_push_status_not_subscribed();
      case 'blocked':
        return m.settings_push_status_blocked();
    }
  }
</script>

{#if status !== null}
  <SettingsSection
    headingId="settings-push-heading"
    heading={m.settings_push_section_title()}
    testId="settings-push-section"
  >
    {#if isLoading}
      <p aria-busy="true"></p>
    {:else}
      <p class="settings-push__status" data-testid="settings-push-status">
        {statusMessage(status)}
      </p>

      {#if showIosNotice}
        <p class="settings-push__ios-notice" data-testid="settings-push-ios-notice">
          {m.settings_push_ios_notice()}
        </p>
      {/if}

      {#if status === 'subscribed'}
        <button
          type="button"
          class="settings-push__action"
          data-testid="settings-push-unsubscribe"
          disabled={isActing}
          onclick={handleUnsubscribe}
        >
          {m.settings_push_unsubscribe()}
        </button>
      {:else if status === 'not_subscribed'}
        <button
          type="button"
          class="settings-push__action"
          data-testid="settings-push-subscribe"
          disabled={isActing}
          onclick={handleSubscribe}
        >
          {m.settings_push_subscribe()}
        </button>
      {/if}
    {/if}
  </SettingsSection>
{/if}

<style>
  .settings-push__status,
  .settings-push__ios-notice {
    margin: 0;
  }

  .settings-push__action {
    background: #1565c0;
    border: 1px solid #1565c0;
    border-radius: 0.375rem;
    color: #fff;
    cursor: pointer;
    font: inherit;
    justify-self: start;
    min-height: 2.25rem;
    padding: 0.375rem 0.75rem;
  }

  .settings-push__action:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .settings-push__action:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
</style>
