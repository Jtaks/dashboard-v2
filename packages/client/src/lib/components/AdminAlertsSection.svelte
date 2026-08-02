<script lang="ts">
  import type { Alert } from '@dashboard/shared';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';

  import {
    createAdminAlert,
    deleteAdminAlert,
    fetchAdminAlerts,
    fetchAdminTopics,
    patchAdminAlert,
  } from '$lib/api/admin.js';
  import { ApiError } from '$lib/api/client.js';
  import {
    defaultFormState,
    formStateFromAlert,
    toCreateBody,
    toPatchBody,
  } from '$lib/admin/alerts-form.js';
  import { resolveApiErrorMessage } from '$lib/admin/api-errors.js';
  import { SEVERITIES, severityLabel } from '$lib/admin/severity.js';
  import * as m from '$lib/paraglide/messages';

  import Refusal from './Refusal.svelte';
  import SettingsSection from './SettingsSection.svelte';

  const queryClient = useQueryClient();

  let refused = $state(false);
  let editingAlert = $state<Alert | null>(null);
  let deleteTarget = $state<Alert | null>(null);
  let form = $state(defaultFormState());
  let formError = $state<string | null>(null);
  let deleteDialog = $state<HTMLDialogElement | null>(null);

  function handleForbidden(error: unknown) {
    if (error instanceof ApiError && error.isForbidden) {
      refused = true;
    }
  }

  const alertsQuery = createQuery(() => ({
    queryKey: ['admin', 'alerts'],
    queryFn: async () => {
      try {
        return await fetchAdminAlerts();
      } catch (error) {
        handleForbidden(error);
        throw error;
      }
    },
    retry: false,
  }));

  const topicsQuery = createQuery(() => ({
    queryKey: ['admin', 'topics'],
    queryFn: async () => {
      try {
        return await fetchAdminTopics();
      } catch (error) {
        handleForbidden(error);
        throw error;
      }
    },
    retry: false,
  }));

  const createAlertMutation = createMutation(() => ({
    mutationFn: createAdminAlert,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'alerts'] });
      resetForm();
    },
    onError: (error) => {
      handleForbidden(error);
      if (!refused) {
        formError = resolveApiErrorMessage(error);
      }
    },
  }));

  const patchAlertMutation = createMutation(() => ({
    mutationFn: ({ id, body }: { id: string; body: ReturnType<typeof toPatchBody> }) =>
      patchAdminAlert(id, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'alerts'] });
      resetForm();
    },
    onError: (error) => {
      handleForbidden(error);
      if (!refused) {
        formError = resolveApiErrorMessage(error);
      }
    },
  }));

  const deleteAlertMutation = createMutation(() => ({
    mutationFn: deleteAdminAlert,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'alerts'] });
      closeDeleteDialog();
    },
    onError: (error) => {
      handleForbidden(error);
      if (!refused) {
        closeDeleteDialog();
      }
    },
  }));

  const showRefusal = $derived(
    refused ||
      (alertsQuery.error instanceof ApiError && alertsQuery.error.isForbidden) ||
      (topicsQuery.error instanceof ApiError && topicsQuery.error.isForbidden),
  );

  const topics = $derived(topicsQuery.data?.topics ?? []);
  const defaultTopic = $derived(topics[0] ?? '');
  const isEditing = $derived(editingAlert !== null);
  const isSaving = $derived(createAlertMutation.isPending || patchAlertMutation.isPending);

  $effect(() => {
    if (!isEditing && defaultTopic && form.topic === '') {
      form = { ...form, topic: defaultTopic };
    }
  });

  function resetForm() {
    editingAlert = null;
    formError = null;
    form = defaultFormState(defaultTopic);
  }

  function startEdit(alert: Alert) {
    editingAlert = alert;
    formError = null;
    form = formStateFromAlert(alert);
  }

  function openDeleteDialog(alert: Alert) {
    deleteTarget = alert;
    deleteDialog?.showModal();
  }

  function closeDeleteDialog() {
    deleteTarget = null;
    deleteDialog?.close();
  }

  function formatExpiry(alert: Alert): string {
    if (!alert.endsAt) {
      return m.admin_alerts_expiry_none();
    }

    const endsAt = new Date(alert.endsAt);
    if (endsAt.getTime() <= Date.now()) {
      return m.admin_alerts_expiry_expired();
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(endsAt);
  }

  function handleEditClick(alert: Alert) {
    return () => startEdit(alert);
  }

  function handleDeleteClick(alert: Alert) {
    return () => openDeleteDialog(alert);
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    formError = null;

    if (isEditing && editingAlert) {
      const patch = toPatchBody(editingAlert, form);
      if (Object.keys(patch).length === 0) {
        resetForm();
        return;
      }

      patchAlertMutation.mutate({ id: editingAlert.id, body: patch });
      return;
    }

    createAlertMutation.mutate(toCreateBody(form));
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    deleteAlertMutation.mutate(deleteTarget.id);
  }
</script>

{#if showRefusal}
  <Refusal />
{:else}
  <SettingsSection
    headingId="admin-alerts-heading"
    heading={m.admin_alerts_section_title()}
    testId="admin-alerts-section"
  >
    {#if alertsQuery.isPending || topicsQuery.isPending}
      <p aria-busy="true"></p>
    {:else if alertsQuery.isSuccess && topicsQuery.isSuccess}
      <section aria-labelledby="admin-alerts-form-heading">
        <h3 id="admin-alerts-form-heading">
          {isEditing ? m.admin_alerts_form_edit_heading() : m.admin_alerts_form_create_heading()}
        </h3>

        <form class="admin-alerts-form" data-testid="admin-alerts-form" onsubmit={handleSubmit}>
          <div class="admin-alerts-form__field">
            <label for="admin-alert-severity">{m.admin_alerts_field_severity()}</label>
            <select
              id="admin-alert-severity"
              data-testid="admin-alert-severity"
              bind:value={form.severity}
              required
            >
              {#each SEVERITIES as severity (severity)}
                <option value={severity}>{severityLabel(severity)}</option>
              {/each}
            </select>
          </div>

          <div class="admin-alerts-form__field">
            <label for="admin-alert-title">{m.admin_alerts_field_title()}</label>
            <input
              id="admin-alert-title"
              type="text"
              data-testid="admin-alert-title"
              bind:value={form.title}
              required
            />
          </div>

          <div class="admin-alerts-form__field">
            <label for="admin-alert-body">{m.admin_alerts_field_body()}</label>
            <span id="admin-alert-body-hint" class="admin-alerts-form__hint">
              {m.admin_alerts_field_body_hint()}
            </span>
            <textarea
              id="admin-alert-body"
              data-testid="admin-alert-body"
              aria-describedby="admin-alert-body-hint"
              bind:value={form.body}
            ></textarea>
          </div>

          <div class="admin-alerts-form__field">
            <label for="admin-alert-topic">{m.admin_alerts_field_topic()}</label>
            <select
              id="admin-alert-topic"
              data-testid="admin-alert-topic"
              bind:value={form.topic}
              required
            >
              {#each topics as topic (topic)}
                <option value={topic}>{topic}</option>
              {/each}
            </select>
          </div>

          <div class="admin-alerts-form__field">
            <label for="admin-alert-ends-at">{m.admin_alerts_field_ends_at()}</label>
            <span id="admin-alert-ends-at-hint" class="admin-alerts-form__hint">
              {m.admin_alerts_field_ends_at_hint()}
            </span>
            <input
              id="admin-alert-ends-at"
              type="datetime-local"
              data-testid="admin-alert-ends-at"
              aria-describedby="admin-alert-ends-at-hint"
              bind:value={form.endsAt}
            />
          </div>

          {#if formError}
            <p class="admin-alerts-form__error" role="alert" data-testid="admin-alerts-error">
              {formError}
            </p>
          {/if}

          <div class="admin-alerts-form__actions">
            <button type="submit" data-testid="admin-alerts-submit" disabled={isSaving}>
              {isEditing ? m.admin_alerts_save_submit() : m.admin_alerts_create_submit()}
            </button>
            {#if isEditing}
              <button type="button" data-testid="admin-alerts-cancel" onclick={resetForm}>
                {m.admin_alerts_cancel()}
              </button>
            {/if}
          </div>
        </form>
      </section>

      <section aria-labelledby="admin-alerts-list-heading">
        <h3 id="admin-alerts-list-heading">{m.admin_alerts_list_label()}</h3>

        {#if alertsQuery.data.length === 0}
          <p>{m.admin_alerts_empty()}</p>
        {:else}
          <div class="admin-alerts-table" role="table" aria-label={m.admin_alerts_list_label()}>
            <div class="admin-alerts-table__row admin-alerts-table__row--header" role="row">
              <span role="columnheader">{m.admin_alerts_col_severity()}</span>
              <span role="columnheader">{m.admin_alerts_col_title()}</span>
              <span role="columnheader">{m.admin_alerts_col_topic()}</span>
              <span role="columnheader">{m.admin_alerts_col_expiry()}</span>
              <span role="columnheader">{m.admin_alerts_col_actions()}</span>
            </div>

            {#each alertsQuery.data as alert (alert.id)}
              <div
                class="admin-alerts-table__row"
                role="row"
                data-testid={`admin-alert-row-${alert.id}`}
              >
                <span class="admin-alerts-table__severity admin-alerts-table__severity--{alert.severity}" role="cell">
                  {severityLabel(alert.severity)}
                </span>
                <span role="cell">{alert.title}</span>
                <span role="cell">{alert.topic}</span>
                <span role="cell">{formatExpiry(alert)}</span>
                <span class="admin-alerts-table__actions" role="cell">
                  <button
                    type="button"
                    data-testid={`admin-alert-edit-${alert.id}`}
                    onclick={handleEditClick(alert)}
                  >
                    {m.admin_alerts_edit()}
                  </button>
                  <button
                    type="button"
                    data-testid={`admin-alert-delete-${alert.id}`}
                    onclick={handleDeleteClick(alert)}
                  >
                    {m.admin_alerts_delete()}
                  </button>
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </SettingsSection>
{/if}

<dialog
  bind:this={deleteDialog}
  class="admin-alerts-delete-dialog"
  aria-labelledby="admin-alerts-delete-title"
  onclose={closeDeleteDialog}
>
  <h3 id="admin-alerts-delete-title">{m.admin_alerts_delete_confirm_title()}</h3>
  <p>{m.admin_alerts_delete_confirm_message()}</p>
  <div class="admin-alerts-delete-dialog__actions">
    <button
      type="button"
      data-testid="admin-alerts-delete-confirm"
      onclick={handleDeleteConfirm}
      disabled={deleteAlertMutation.isPending}
    >
      {m.admin_alerts_delete_confirm_submit()}
    </button>
    <button type="button" data-testid="admin-alerts-delete-cancel" onclick={closeDeleteDialog}>
      {m.admin_alerts_delete_confirm_cancel()}
    </button>
  </div>
</dialog>

<style>
  .admin-alerts-form {
    display: grid;
    gap: 0.75rem;
  }

  .admin-alerts-form__field {
    display: grid;
    gap: 0.25rem;
  }

  .admin-alerts-form__hint {
    color: #555;
    font-size: 0.875rem;
  }

  .admin-alerts-form__error {
    color: #9a1b1b;
    margin: 0;
  }

  .admin-alerts-form__actions,
  .admin-alerts-delete-dialog__actions,
  .admin-alerts-table__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .admin-alerts-table {
    display: grid;
    gap: 0.5rem;
  }

  .admin-alerts-table__row {
    display: grid;
    gap: 0.5rem 1rem;
    grid-template-columns: minmax(4rem, 0.75fr) minmax(6rem, 2fr) minmax(4rem, 1fr) minmax(
        5rem,
        1fr
      ) minmax(6rem, 1.25fr);
  }

  .admin-alerts-table__row--header {
    font-weight: 600;
  }

  .admin-alerts-table__severity--info {
    color: var(--severity-info-text);
    font-weight: 600;
  }

  .admin-alerts-table__severity--success {
    color: var(--severity-success-text);
    font-weight: 600;
  }

  .admin-alerts-table__severity--warning {
    color: var(--severity-warning-text);
    font-weight: 600;
  }

  .admin-alerts-table__severity--error {
    color: var(--severity-error-text);
    font-weight: 600;
  }

  .admin-alerts-delete-dialog {
    border: 1px solid #ccc;
    border-radius: 0.5rem;
    max-width: 28rem;
    padding: 1rem;
  }

  @media (max-width: 40rem) {
    .admin-alerts-table__row {
      grid-template-columns: 1fr;
    }

    .admin-alerts-table__row--header {
      display: none;
    }
  }
</style>
