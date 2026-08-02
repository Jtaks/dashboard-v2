<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import {
    deriveSettingsPushView,
    pushState,
    readShouldShowIosPwaNotice,
    refreshPushState,
    setPushSubscriptionState,
    subscribeToPush,
    unsubscribeFromPush,
  } from '$lib/push/index.js';

  let busy = $state(false);

  const state = $derived($pushState);
  const view = $derived(
    deriveSettingsPushView({
      supported: state.supported,
      hasSubscription: state.subscription !== null,
      permission: state.permission,
    }),
  );

  const showIosNotice = $derived(readShouldShowIosPwaNotice());

  const statusLabel = $derived(
    view.status === 'subscribed'
      ? m.settings_push_status_subscribed()
      : view.status === 'blocked'
        ? m.settings_push_status_blocked()
        : m.settings_push_status_not_subscribed(),
  );

  $effect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await refreshPushState();
      } catch {
        // Registration failures must not break settings.
      }
      if (cancelled) {
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  async function subscribe() {
    if (busy) {
      return;
    }
    busy = true;
    try {
      const subscription = await subscribeToPush({ clearDismissed: true });
      setPushSubscriptionState(subscription);
    } catch {
      await refreshPushState().catch(() => undefined);
    } finally {
      busy = false;
    }
  }

  async function unsubscribe() {
    if (busy) {
      return;
    }
    busy = true;
    try {
      await unsubscribeFromPush(state.subscription);
      setPushSubscriptionState(null);
    } catch {
      await refreshPushState().catch(() => undefined);
    } finally {
      busy = false;
    }
  }
</script>

<div
  class="settings-push"
  data-testid="settings-push"
  data-push-status={view.status}
  data-push-ready={state.ready ? 'true' : 'false'}
>
  {#if showIosNotice}
    <p class="settings-push-ios" data-testid="settings-push-ios-notice">
      {m.settings_push_ios_notice()}
    </p>
  {/if}

  <p class="settings-push-status" data-testid="settings-push-status" aria-live="polite">
    {statusLabel}
  </p>

  {#if view.status === 'blocked'}
    <p class="settings-push-blocked" data-testid="settings-push-blocked-body">
      {m.settings_push_blocked_body()}
    </p>
  {/if}

  {#if view.showSubscribe || view.showUnsubscribe}
    <div class="settings-push-actions">
      {#if view.showSubscribe}
        <button
          type="button"
          class="settings-push-action"
          data-testid="settings-push-subscribe"
          disabled={busy}
          onclick={() => void subscribe()}
        >
          {m.settings_push_subscribe()}
        </button>
      {/if}
      {#if view.showUnsubscribe}
        <button
          type="button"
          class="settings-push-action"
          data-testid="settings-push-unsubscribe"
          disabled={busy}
          onclick={() => void unsubscribe()}
        >
          {m.settings_push_unsubscribe()}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .settings-push {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    min-width: 0;
  }

  .settings-push-ios,
  .settings-push-status,
  .settings-push-blocked {
    margin: 0;
    line-height: 1.45;
  }

  .settings-push-ios {
    font-size: 0.925rem;
  }

  .settings-push-status {
    font-weight: 600;
  }

  .settings-push-blocked {
    font-size: 0.925rem;
  }

  .settings-push-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .settings-push-action {
    padding: 0.35rem 0.65rem;
    border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
    background: color-mix(in srgb, currentColor 8%, transparent);
    color: inherit;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .settings-push-action:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .settings-push-action:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
