<script lang="ts">
  import type { PushResult } from '@dashboard/shared';
  import { createMutation, createQuery } from '@tanstack/svelte-query';

  import { fetchAdminTopics, sendAdminPush } from '$lib/api/admin.js';
  import { ApiError } from '$lib/api/client.js';
  import { resolvePushApiErrorMessage } from '$lib/admin/push-api-errors.js';
  import * as m from '$lib/paraglide/messages';

  import SettingsSection from './SettingsSection.svelte';

  type PushFormState = {
    title: string;
    body: string;
    url: string;
    topic: string;
  };

  function defaultFormState(topic = ''): PushFormState {
    return {
      title: '',
      body: '',
      url: '',
      topic,
    };
  }

  let refused = $state(false);
  let form = $state(defaultFormState());
  let formError = $state<string | null>(null);
  let lastResult = $state<PushResult | null>(null);

  function handleForbidden(error: unknown) {
    if (error instanceof ApiError && error.isForbidden) {
      refused = true;
    }
  }

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

  const sendPushMutation = createMutation(() => ({
    mutationFn: sendAdminPush,
    onSuccess: (result) => {
      formError = null;
      lastResult = result;
      form = defaultFormState(defaultTopic);
    },
    onError: (error) => {
      handleForbidden(error);
      if (!refused) {
        formError = resolvePushApiErrorMessage(error);
      }
    },
  }));

  const showRefusal = $derived(
    refused ||
      (topicsQuery.error instanceof ApiError && topicsQuery.error.isForbidden),
  );

  const topics = $derived(topicsQuery.data?.topics ?? []);
  const defaultTopic = $derived(topics[0] ?? '');
  const isSending = $derived(sendPushMutation.isPending);

  $effect(() => {
    if (defaultTopic && form.topic === '') {
      form = { ...form, topic: defaultTopic };
    }
  });

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    formError = null;
    lastResult = null;

    sendPushMutation.mutate({
      title: form.title,
      body: form.body,
      url: form.url.trim() === '' ? null : form.url.trim(),
      topic: form.topic,
    });
  }
</script>

{#if !showRefusal && topicsQuery.isSuccess}
  <SettingsSection
    headingId="admin-push-heading"
    heading={m.admin_push_section_title()}
    testId="admin-push-section"
  >
    <section aria-labelledby="admin-push-form-heading">
        <h3 id="admin-push-form-heading">{m.admin_push_form_heading()}</h3>

        <form class="admin-push-form" data-testid="admin-push-form" onsubmit={handleSubmit}>
          <div class="admin-push-form__field">
            <label for="admin-push-title">{m.admin_push_field_title()}</label>
            <input
              id="admin-push-title"
              type="text"
              data-testid="admin-push-title"
              bind:value={form.title}
              required
            />
          </div>

          <div class="admin-push-form__field">
            <label for="admin-push-body">{m.admin_push_field_body()}</label>
            <textarea
              id="admin-push-body"
              data-testid="admin-push-body"
              bind:value={form.body}
              required
            ></textarea>
          </div>

          <div class="admin-push-form__field">
            <label for="admin-push-url">{m.admin_push_field_url()}</label>
            <span id="admin-push-url-hint" class="admin-push-form__hint">
              {m.admin_push_field_url_hint()}
            </span>
            <input
              id="admin-push-url"
              type="url"
              data-testid="admin-push-url"
              aria-describedby="admin-push-url-hint"
              bind:value={form.url}
            />
          </div>

          <div class="admin-push-form__field">
            <label for="admin-push-topic">{m.admin_push_field_topic()}</label>
            <select
              id="admin-push-topic"
              data-testid="admin-push-topic"
              bind:value={form.topic}
              required
            >
              {#each topics as topic (topic)}
                <option value={topic}>{topic}</option>
              {/each}
            </select>
          </div>

          {#if formError}
            <p class="admin-push-form__error" role="alert" data-testid="admin-push-error">
              {formError}
            </p>
          {/if}

          {#if lastResult}
            <p class="admin-push-form__result" data-testid="admin-push-result">
              <span data-testid="admin-push-attempted">
                {m.admin_push_result_attempted({ count: lastResult.attempted })}
              </span>
              <span data-testid="admin-push-failed">
                {m.admin_push_result_failed({ count: lastResult.failed })}
              </span>
            </p>
          {/if}

          <div class="admin-push-form__actions">
            <button type="submit" data-testid="admin-push-submit" disabled={isSending}>
              {m.admin_push_send_submit()}
            </button>
          </div>
        </form>
    </section>
  </SettingsSection>
{/if}

<style>
  .admin-push-form {
    display: grid;
    gap: 0.75rem;
  }

  .admin-push-form__field {
    display: grid;
    gap: 0.25rem;
  }

  .admin-push-form__hint {
    color: #555;
    font-size: 0.875rem;
  }

  .admin-push-form__error {
    color: #9a1b1b;
    margin: 0;
  }

  .admin-push-form__result {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin: 0;
  }

  .admin-push-form__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
