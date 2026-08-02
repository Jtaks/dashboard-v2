<script lang="ts">
  import type { PushResult, PushSend } from '@dashboard/shared';
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { sendAdminPush } from '$lib/admin/push.js';
  import { ApiRequestError, ForbiddenError } from '$lib/api/client.js';
  import { m } from '$lib/paraglide/messages.js';
  import { adminTopicsQueryOptions } from '$lib/settings/admin-topics.js';

  let {
    forbidden = $bindable<ForbiddenError | null>(null),
  }: {
    forbidden?: ForbiddenError | null;
  } = $props();

  const topicsQuery = createQuery(() => adminTopicsQueryOptions());

  let title = $state('');
  let body = $state('');
  let url = $state('');
  let topic = $state('');
  let formError = $state<string | null>(null);
  let result = $state<PushResult | null>(null);

  const topics = $derived(topicsQuery.data ?? []);

  $effect(() => {
    if (!topic && topics.length > 0) {
      topic = topics[0]!;
    }
  });

  const sendMutation = createMutation(() => ({
    mutationFn: sendAdminPush,
    onSuccess: (data) => {
      result = data;
      formError = null;
    },
    onError: (error: unknown) => {
      if (error instanceof ForbiddenError) {
        forbidden = error;
        return;
      }
      formError =
        error instanceof ApiRequestError && error.code === 'invalid_body'
          ? m.admin_push_error()
          : m.error_request_failed();
    },
  }));

  function submitForm(event: SubmitEvent) {
    event.preventDefault();
    formError = null;
    result = null;

    const payload: PushSend = {
      title: title.trim(),
      body: body.trim(),
      url: url.trim() === '' ? null : url.trim(),
      topic,
    };
    sendMutation.mutate(payload);
  }
</script>

<section class="admin-push" aria-labelledby="admin-push-heading" data-testid="admin-push">
  <h2 id="admin-push-heading">{m.admin_push_heading()}</h2>

  {#if topicsQuery.isPending}
    <div data-testid="admin-push-loading" role="status">{m.admin_alerts_loading()}</div>
  {:else if topicsQuery.isError}
    <div data-testid="admin-push-error" role="alert">
      <p>{m.admin_alerts_error()}</p>
    </div>
  {:else}
    <form class="admin-push-form" data-testid="admin-push-form" onsubmit={submitForm}>
      <div class="field">
        <label for="admin-push-topic">{m.admin_push_topic()}</label>
        <select
          id="admin-push-topic"
          data-testid="admin-push-topic"
          value={topic}
          onchange={(e) => (topic = e.currentTarget.value)}
          required
        >
          {#each topics as t (t)}
            <option value={t}>{t}</option>
          {/each}
        </select>
      </div>

      <div class="field">
        <label for="admin-push-title">{m.admin_push_title_field()}</label>
        <input
          id="admin-push-title"
          data-testid="admin-push-title"
          type="text"
          value={title}
          oninput={(e) => (title = e.currentTarget.value)}
          required
        />
      </div>

      <div class="field">
        <label for="admin-push-body">{m.admin_push_body()}</label>
        <textarea
          id="admin-push-body"
          data-testid="admin-push-body"
          rows="3"
          value={body}
          oninput={(e) => (body = e.currentTarget.value)}
          required
        ></textarea>
      </div>

      <div class="field">
        <label for="admin-push-url">{m.admin_push_url()}</label>
        <input
          id="admin-push-url"
          data-testid="admin-push-url"
          type="text"
          value={url}
          oninput={(e) => (url = e.currentTarget.value)}
          autocomplete="off"
        />
        <p class="hint">{m.admin_push_url_hint()}</p>
      </div>

      {#if formError}
        <p data-testid="admin-push-form-error" role="alert">{formError}</p>
      {/if}

      {#if result}
        <p data-testid="admin-push-result" role="status">
          {m.admin_push_result({
            attempted: result.attempted,
            failed: result.failed,
          })}
        </p>
      {/if}

      <div class="form-actions">
        <button
          type="submit"
          data-testid="admin-push-submit"
          disabled={sendMutation.isPending || topics.length === 0}
        >
          {m.admin_push_send()}
        </button>
      </div>
    </form>
  {/if}
</section>

<style>
  .admin-push {
    margin-top: 2rem;
    padding-top: 1.25rem;
    border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  }

  .admin-push h2 {
    margin: 0 0 1rem;
    font-size: 1.15rem;
  }

  .admin-push-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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

  .form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
