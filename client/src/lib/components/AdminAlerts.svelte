<script lang="ts">
  import type { Alert, Severity } from '@dashboard/shared';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import {
    adminAlertsQueryKey,
    adminAlertsQueryOptions,
    createAdminAlert,
    deleteAdminAlert,
    patchAdminAlert,
  } from '$lib/admin/alerts.js';
  import {
    alertToFormState,
    emptyAlertForm,
    toCreateAlertBody,
    toPatchAlertBody,
    type AlertFormState,
  } from '$lib/admin/form.js';
  import { resolveApiErrorMessage, SEVERITIES, severityLabel } from '$lib/admin/messages.js';
  import { ApiRequestError, ForbiddenError } from '$lib/api/client.js';
  import AdminPush from '$lib/components/AdminPush.svelte';
  import Forbidden from '$lib/components/Forbidden.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { adminTopicsQueryOptions } from '$lib/settings/admin-topics.js';

  const queryClient = useQueryClient();

  const topicsQuery = createQuery(() => adminTopicsQueryOptions());
  const alertsQuery = createQuery(() => adminAlertsQueryOptions());

  let pushForbidden = $state<ForbiddenError | null>(null);

  const forbidden = $derived(
    topicsQuery.error instanceof ForbiddenError
      ? topicsQuery.error
      : alertsQuery.error instanceof ForbiddenError
        ? alertsQuery.error
        : null,
  );

  type EditorMode = { kind: 'create' } | { kind: 'edit'; alert: Alert; baseline: AlertFormState };

  let editor = $state<EditorMode | null>(null);
  let form = $state<AlertFormState>(emptyAlertForm());
  let pendingDeleteId = $state<string | null>(null);
  let formError = $state<string | null>(null);

  const topics = $derived(topicsQuery.data ?? []);
  const alerts = $derived(alertsQuery.data ?? []);

  function openCreate() {
    formError = null;
    pendingDeleteId = null;
    const defaultTopic = topics[0] ?? '';
    form = emptyAlertForm(defaultTopic);
    editor = { kind: 'create' };
  }

  function openEdit(alert: Alert) {
    formError = null;
    pendingDeleteId = null;
    const baseline = alertToFormState(alert);
    form = { ...baseline };
    editor = { kind: 'edit', alert, baseline };
  }

  function closeEditor() {
    editor = null;
    formError = null;
  }

  function setSeverity(value: string) {
    if ((SEVERITIES as readonly string[]).includes(value)) {
      form = { ...form, severity: value as Severity };
    }
  }

  async function invalidateAlerts() {
    await queryClient.invalidateQueries({ queryKey: adminAlertsQueryKey });
  }

  const createAlertMutation = createMutation(() => ({
    mutationFn: createAdminAlert,
    onSuccess: async () => {
      await invalidateAlerts();
      closeEditor();
    },
    onError: (error: unknown) => {
      if (error instanceof ForbiddenError) {
        return;
      }
      formError = resolveApiErrorMessage(error instanceof ApiRequestError ? error.code : null);
    },
  }));

  const patchAlertMutation = createMutation(() => ({
    mutationFn: ({ id, body }: { id: string; body: ReturnType<typeof toPatchAlertBody> }) =>
      patchAdminAlert(id, body),
    onSuccess: async () => {
      await invalidateAlerts();
      closeEditor();
    },
    onError: (error: unknown) => {
      if (error instanceof ForbiddenError) {
        return;
      }
      formError = resolveApiErrorMessage(error instanceof ApiRequestError ? error.code : null);
    },
  }));

  const deleteAlertMutation = createMutation(() => ({
    mutationFn: deleteAdminAlert,
    onSuccess: async () => {
      pendingDeleteId = null;
      await invalidateAlerts();
    },
    onError: (error: unknown) => {
      if (error instanceof ForbiddenError) {
        return;
      }
      formError = resolveApiErrorMessage(error instanceof ApiRequestError ? error.code : null);
      pendingDeleteId = null;
    },
  }));

  function submitForm(event: Event) {
    event.preventDefault();
    formError = null;

    if (editor?.kind === 'create') {
      createAlertMutation.mutate(toCreateAlertBody(form));
      return;
    }

    if (editor?.kind === 'edit') {
      const body = toPatchAlertBody(form, editor.baseline);
      if (Object.keys(body).length === 0) {
        closeEditor();
        return;
      }
      patchAlertMutation.mutate({ id: editor.alert.id, body });
    }
  }

  function requestDelete(id: string) {
    formError = null;
    editor = null;
    pendingDeleteId = id;
  }

  function confirmDelete() {
    if (pendingDeleteId) {
      deleteAlertMutation.mutate(pendingDeleteId);
    }
  }

  function cancelDelete() {
    pendingDeleteId = null;
  }

  function endsAtDisplay(endsAt: string | null): string {
    return endsAt ?? m.admin_alert_ends_at_none();
  }

  const mutationForbidden = $derived(
    createAlertMutation.error instanceof ForbiddenError
      ? createAlertMutation.error
      : patchAlertMutation.error instanceof ForbiddenError
        ? patchAlertMutation.error
        : deleteAlertMutation.error instanceof ForbiddenError
          ? deleteAlertMutation.error
          : null,
  );

  const showForbidden = $derived(forbidden ?? mutationForbidden ?? pushForbidden);
  const busy = $derived(
    createAlertMutation.isPending ||
      patchAlertMutation.isPending ||
      deleteAlertMutation.isPending,
  );
</script>

{#if showForbidden}
  <Forbidden code={showForbidden.code} />
{:else}
  <main data-testid="admin-page" class="admin-page">
    <h1>{m.admin_title()}</h1>

    <section class="admin-alerts" aria-labelledby="admin-alerts-heading">
      <div class="admin-alerts-header">
        <h2 id="admin-alerts-heading">{m.admin_alerts_heading()}</h2>
        <button
          type="button"
          data-testid="admin-alert-new"
          onclick={openCreate}
          disabled={topicsQuery.isPending || topics.length === 0}
        >
          {m.admin_alert_new()}
        </button>
      </div>

      {#if topicsQuery.isPending || alertsQuery.isPending}
        <div data-testid="admin-alerts-loading" role="status">{m.admin_alerts_loading()}</div>
      {:else if topicsQuery.isError || alertsQuery.isError}
        <div data-testid="admin-alerts-error" role="alert">
          <p>{m.admin_alerts_error()}</p>
          <button
            type="button"
            data-testid="admin-alerts-retry"
            onclick={() => {
              void topicsQuery.refetch();
              void alertsQuery.refetch();
            }}
          >
            {m.admin_alerts_retry()}
          </button>
        </div>
      {:else}
        {#if editor}
          <form
            class="admin-alert-form"
            data-testid="admin-alert-form"
            data-mode={editor.kind}
            onsubmit={submitForm}
          >
            <h3>
              {editor.kind === 'create' ? m.admin_alert_compose() : m.admin_alert_edit_heading()}
            </h3>

            <div class="field">
              <label for="admin-alert-severity">{m.admin_alert_severity()}</label>
              <select
                id="admin-alert-severity"
                data-testid="admin-alert-severity"
                value={form.severity}
                onchange={(e) => setSeverity(e.currentTarget.value)}
                required
              >
                {#each SEVERITIES as severity (severity)}
                  <option value={severity}>{severityLabel(severity)}</option>
                {/each}
              </select>
            </div>

            <div class="field">
              <label for="admin-alert-topic">{m.admin_alert_topic()}</label>
              <!-- Options come only from GET /api/admin/topics — nothing hard-coded. -->
              <select
                id="admin-alert-topic"
                data-testid="admin-alert-topic"
                value={form.topic}
                onchange={(e) => (form = { ...form, topic: e.currentTarget.value })}
                required
              >
                {#each topics as topic (topic)}
                  <option value={topic}>{topic}</option>
                {/each}
              </select>
            </div>

            <div class="field">
              <label for="admin-alert-title">{m.admin_alert_title_field()}</label>
              <input
                id="admin-alert-title"
                data-testid="admin-alert-title"
                type="text"
                value={form.title}
                oninput={(e) => (form = { ...form, title: e.currentTarget.value })}
                required
              />
            </div>

            <div class="field">
              <label for="admin-alert-body">{m.admin_alert_body()}</label>
              <textarea
                id="admin-alert-body"
                data-testid="admin-alert-body"
                rows="3"
                value={form.body}
                oninput={(e) => (form = { ...form, body: e.currentTarget.value })}
              ></textarea>
              <p class="hint">{m.admin_alert_body_hint()}</p>
            </div>

            <div class="field">
              <label for="admin-alert-ends-at">{m.admin_alert_ends_at()}</label>
              <input
                id="admin-alert-ends-at"
                data-testid="admin-alert-ends-at"
                type="text"
                value={form.endsAt}
                oninput={(e) => (form = { ...form, endsAt: e.currentTarget.value })}
                autocomplete="off"
              />
              <p class="hint">{m.admin_alert_ends_at_hint()}</p>
            </div>

            {#if formError}
              <p data-testid="admin-alert-form-error" role="alert">{formError}</p>
            {/if}

            <div class="form-actions">
              <button
                type="submit"
                data-testid="admin-alert-submit"
                disabled={busy}
              >
                {editor.kind === 'create' ? m.admin_alert_create() : m.admin_alert_save()}
              </button>
              <button
                type="button"
                data-testid="admin-alert-cancel"
                onclick={closeEditor}
                disabled={busy}
              >
                {m.admin_alert_cancel()}
              </button>
            </div>
          </form>
        {/if}

        {#if pendingDeleteId}
          <div
            class="delete-confirm"
            data-testid="admin-alert-delete-confirm"
            role="alertdialog"
            aria-labelledby="admin-alert-delete-title"
            aria-modal="true"
          >
            <h3 id="admin-alert-delete-title">{m.admin_alert_delete_confirm_title()}</h3>
            <div class="form-actions">
              <button
                type="button"
                data-testid="admin-alert-delete-confirm-btn"
                onclick={confirmDelete}
                disabled={busy}
              >
                {m.admin_alert_delete_confirm()}
              </button>
              <button
                type="button"
                data-testid="admin-alert-delete-cancel-btn"
                onclick={cancelDelete}
                disabled={busy}
              >
                {m.admin_alert_delete_cancel()}
              </button>
            </div>
          </div>
        {/if}

        {#if alerts.length === 0}
          <p data-testid="admin-alerts-empty">{m.admin_alerts_empty()}</p>
        {:else}
          <ul class="alert-list" data-testid="admin-alerts-list" aria-label={m.admin_alerts_list_label()}>
            {#each alerts as alert (alert.id)}
              <li class="alert-row" data-testid="admin-alert-row" data-alert-id={alert.id}>
                <div class="alert-row-main">
                  <span class="alert-title" data-testid="admin-alert-row-title">{alert.title}</span>
                  <dl class="alert-meta">
                    <div>
                      <dt>{m.admin_alert_severity()}</dt>
                      <dd data-testid="admin-alert-row-severity">{severityLabel(alert.severity)}</dd>
                    </div>
                    <div>
                      <dt>{m.admin_alert_topic()}</dt>
                      <dd data-testid="admin-alert-row-topic">{alert.topic}</dd>
                    </div>
                    <div>
                      <dt>{m.admin_alert_ends_at()}</dt>
                      <dd data-testid="admin-alert-row-ends-at">{endsAtDisplay(alert.endsAt)}</dd>
                    </div>
                  </dl>
                </div>
                <div class="alert-row-actions">
                  <button
                    type="button"
                    data-testid="admin-alert-edit"
                    onclick={() => openEdit(alert)}
                    disabled={busy}
                  >
                    {m.admin_alert_edit()}
                  </button>
                  <button
                    type="button"
                    data-testid="admin-alert-delete"
                    onclick={() => requestDelete(alert.id)}
                    disabled={busy}
                  >
                    {m.admin_alert_delete()}
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </section>

    <AdminPush bind:forbidden={pushForbidden} />
  </main>
{/if}

<style>
  .admin-page {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 1rem;
  }

  .admin-page h1 {
    margin: 0 0 1.25rem;
    font-size: 1.5rem;
  }

  .admin-alerts-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .admin-alerts-header h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  .admin-alert-form,
  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
    padding: 1rem 0;
    border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  }

  .admin-alert-form h3,
  .delete-confirm h3 {
    margin: 0;
    font-size: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .field input,
  .field select,
  .field textarea {
    max-width: 100%;
    font: inherit;
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .form-actions,
  .alert-row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .alert-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .alert-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  }

  .alert-row-main {
    min-width: 0;
    flex: 1;
  }

  .alert-title {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .alert-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.25rem;
    margin: 0;
  }

  .alert-meta div {
    margin: 0;
  }

  .alert-meta dt {
    margin: 0;
    font-size: 0.75rem;
    opacity: 0.75;
  }

  .alert-meta dd {
    margin: 0.15rem 0 0;
  }
</style>
