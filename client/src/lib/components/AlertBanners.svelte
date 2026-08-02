<script lang="ts">
  import type { Alert } from '@dashboard/shared';
  import { alertDismissLabel, severityLabel } from '$lib/alerts/messages.js';
  import {
    dismissAlertId,
    readDismissedIds,
    syncDismissedWithLiveAlerts,
  } from '$lib/alerts/dismissed.js';
  import { m } from '$lib/paraglide/messages.js';

  let {
    alerts,
  }: {
    /** Live alerts from GET /api/alerts, or null while unset / failed. */
    alerts: Alert[] | null;
  } = $props();

  let dismissed = $state<string[]>(readDismissedIds());

  $effect(() => {
    if (alerts) {
      dismissed = syncDismissedWithLiveAlerts(alerts.map((alert) => alert.id));
    }
  });

  const visible = $derived((alerts ?? []).filter((alert) => !dismissed.includes(alert.id)));

  function dismiss(id: string) {
    dismissed = dismissAlertId(id);
  }
</script>

{#if visible.length > 0}
  <div
    class="alert-banners"
    data-testid="alert-banners"
    role="region"
    aria-label={m.alerts_region()}
  >
    {#each visible as alert (alert.id)}
      <article
        class="alert-banner severity-{alert.severity}"
        data-testid="alert-banner"
        data-alert-id={alert.id}
        data-severity={alert.severity}
        aria-label={severityLabel(alert.severity)}
      >
        <div class="alert-content">
          <p class="alert-severity">{severityLabel(alert.severity)}</p>
          <h2 class="alert-title" data-testid="alert-banner-title">{alert.title}</h2>
          {#if alert.body !== null}
            <p class="alert-body" data-testid="alert-banner-body">{alert.body}</p>
          {/if}
        </div>
        <button
          type="button"
          class="alert-dismiss"
          data-testid="alert-dismiss"
          aria-label={alertDismissLabel()}
          onclick={() => dismiss(alert.id)}
        >
          {alertDismissLabel()}
        </button>
      </article>
    {/each}
  </div>
{/if}

<style>
  .alert-banners {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .alert-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  }

  .alert-content {
    min-width: 0;
    flex: 1 1 12rem;
  }

  .alert-severity {
    margin: 0 0 0.2rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .alert-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 650;
    line-height: 1.3;
  }

  .alert-body {
    margin: 0.35rem 0 0;
    font-size: 0.925rem;
    line-height: 1.4;
  }

  .alert-dismiss {
    flex: 0 0 auto;
    padding: 0.35rem 0.65rem;
    border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
    background: color-mix(in srgb, currentColor 8%, transparent);
    color: inherit;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .alert-dismiss:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .severity-info {
    color: var(--severity-info);
    background: color-mix(in srgb, var(--severity-info) var(--severity-tint), transparent);
  }

  .severity-success {
    color: var(--severity-success);
    background: color-mix(in srgb, var(--severity-success) var(--severity-tint), transparent);
  }

  .severity-warning {
    color: var(--severity-warning);
    background: color-mix(
      in srgb,
      var(--severity-warning) var(--severity-warning-tint),
      transparent
    );
  }

  .severity-error {
    color: var(--severity-error);
    background: color-mix(in srgb, var(--severity-error) var(--severity-tint), transparent);
  }
</style>
