<script lang="ts">
  import type { Alert, Severity } from '@dashboard/shared';
  import { createQuery } from '@tanstack/svelte-query';

  import { severityLabel } from '$lib/admin/severity.js';
  import { alertsQueryOptions } from '$lib/alerts/query.js';
  import { dismissedAlertsStore } from '$lib/alerts/store.js';
  import * as m from '$lib/paraglide/messages';

  const alertsQuery = createQuery(() => alertsQueryOptions());

  let dismissedIds = $state<string[]>([]);

  $effect(() => {
    const unsubscribe = dismissedAlertsStore.subscribe((ids) => {
      dismissedIds = ids;
    });

    return unsubscribe;
  });

  $effect(() => {
    if (!alertsQuery.isSuccess) {
      return;
    }

    const alerts = alertsQuery.data ?? [];
    dismissedAlertsStore.syncWithAlerts(alerts.map((alert) => alert.id));
  });

  const visibleAlerts = $derived(
    alertsQuery.data?.filter((alert) => !dismissedIds.includes(alert.id)) ?? [],
  );

  function dismiss(alert: Alert) {
    dismissedAlertsStore.dismiss(alert.id);
    document.getElementById('alert-dismiss-focus-target')?.focus();
  }

  function handleDismissClick(alert: Alert) {
    return () => dismiss(alert);
  }

  function severityClass(severity: Severity): string {
    return `alert-banner--${severity}`;
  }
</script>

{#if visibleAlerts.length > 0}
  <section class="alerts-banner" aria-label={m.alerts_banner_region_label()}>
    {#each visibleAlerts as alert (alert.id)}
      <article
        class="alert-banner {severityClass(alert.severity)}"
        data-testid={`alert-banner-${alert.id}`}
      >
        <div class="alert-banner__content">
          <p class="alert-banner__severity">{severityLabel(alert.severity)}</p>
          <h2 class="alert-banner__title">{alert.title}</h2>
          {#if alert.body}
            <p class="alert-banner__body">{alert.body}</p>
          {/if}
        </div>
        <button
          type="button"
          class="alert-banner__dismiss"
          data-testid={`alert-dismiss-${alert.id}`}
          onclick={handleDismissClick(alert)}
        >
          {m.alert_dismiss()}
        </button>
      </article>
    {/each}
  </section>
{/if}

<style>
  .alerts-banner {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .alert-banner {
    align-items: flex-start;
    border: 1px solid;
    border-radius: 0.375rem;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    padding: 0.75rem 1rem;
  }

  .alert-banner--info {
    color: var(--severity-info-banner-fg);
    background: var(--severity-info-banner-bg);
    border-color: var(--severity-info-banner-border);
  }

  .alert-banner--success {
    color: var(--severity-success-banner-fg);
    background: var(--severity-success-banner-bg);
    border-color: var(--severity-success-banner-border);
  }

  .alert-banner--warning {
    color: var(--severity-warning-banner-fg);
    background: var(--severity-warning-banner-bg);
    border-color: var(--severity-warning-banner-border);
  }

  .alert-banner--error {
    color: var(--severity-error-banner-fg);
    background: var(--severity-error-banner-bg);
    border-color: var(--severity-error-banner-border);
  }

  .alert-banner__content {
    flex: 1;
    min-width: 0;
  }

  .alert-banner__severity {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    margin: 0 0 0.25rem;
    text-transform: uppercase;
  }

  .alert-banner__title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .alert-banner__body {
    margin: 0.5rem 0 0;
  }

  .alert-banner__dismiss {
    background: transparent;
    border: 1px solid currentColor;
    border-radius: 0.375rem;
    cursor: pointer;
    flex-shrink: 0;
    font: inherit;
    min-height: 2.25rem;
    padding: 0.375rem 0.75rem;
  }

  .alert-banner__dismiss:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
</style>
