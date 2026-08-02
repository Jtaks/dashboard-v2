<script lang="ts">
  import { dismissPushPrompt } from '$lib/push/storage.js';
  import { subscribeToPush } from '$lib/push/subscribe.js';
  import * as m from '$lib/paraglide/messages';

  type PushPermissionPromptProps = {
    registration: ServiceWorkerRegistration;
    onClose: () => void;
  };

  let { registration, onClose }: PushPermissionPromptProps = $props();
  let isSubscribing = $state(false);

  function handleDecline() {
    dismissPushPrompt();
    onClose();
  }

  async function handleAccept() {
    if (isSubscribing) {
      return;
    }

    isSubscribing = true;

    try {
      await subscribeToPush(registration);
    } finally {
      isSubscribing = false;
      onClose();
    }
  }
</script>

<aside
  class="push-prompt"
  role="region"
  aria-labelledby="push-prompt-heading"
  data-testid="push-permission-prompt"
>
  <div class="push-prompt__content">
    <h2 id="push-prompt-heading" class="push-prompt__heading">{m.push_prompt_heading()}</h2>
    <p class="push-prompt__message">{m.push_prompt_message()}</p>
  </div>
  <div class="push-prompt__actions">
    <button
      type="button"
      class="push-prompt__decline"
      data-testid="push-prompt-decline"
      disabled={isSubscribing}
      onclick={handleDecline}
    >
      {m.push_prompt_decline()}
    </button>
    <button
      type="button"
      class="push-prompt__accept"
      data-testid="push-prompt-accept"
      disabled={isSubscribing}
      onclick={handleAccept}
    >
      {m.push_prompt_accept()}
    </button>
  </div>
</aside>

<style>
  .push-prompt {
    align-items: flex-start;
    background: #e3f2fd;
    border: 1px solid #1565c0;
    border-radius: 0.375rem;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
  }

  .push-prompt__content {
    flex: 1;
    min-width: 0;
  }

  .push-prompt__heading {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.25rem;
  }

  .push-prompt__message {
    margin: 0;
  }

  .push-prompt__actions {
    display: flex;
    flex-shrink: 0;
    gap: 0.5rem;
  }

  .push-prompt__decline,
  .push-prompt__accept {
    background: transparent;
    border: 1px solid currentColor;
    border-radius: 0.375rem;
    cursor: pointer;
    font: inherit;
    min-height: 2.25rem;
    padding: 0.375rem 0.75rem;
  }

  .push-prompt__accept {
    background: #1565c0;
    border-color: #1565c0;
    color: #fff;
  }

  .push-prompt__decline:focus-visible,
  .push-prompt__accept:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .push-prompt__decline:disabled,
  .push-prompt__accept:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
</style>
