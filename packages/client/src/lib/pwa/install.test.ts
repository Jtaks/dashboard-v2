import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  captureBeforeInstallPrompt,
  promptInstall,
  subscribeInstallAvailability,
} from './install.js';

function createPromptEvent(): Event & {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
} {
  const prompt = vi.fn(async () => undefined);
  const userChoice = Promise.resolve({
    outcome: 'accepted' as const,
    platform: 'web',
  });

  return {
    preventDefault: vi.fn(),
    prompt,
    userChoice,
  } as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pwa install prompt', () => {
  it('captures beforeinstallprompt and reports availability', () => {
    const event = createPromptEvent();
    const listener = vi.fn();

    const unsubscribe = subscribeInstallAvailability(listener);
    captureBeforeInstallPrompt(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(false);
    expect(listener).toHaveBeenCalledWith(true);

    unsubscribe();
  });

  it('prompts installation and clears the deferred event', async () => {
    const event = createPromptEvent();
    captureBeforeInstallPrompt(event);

    const accepted = await promptInstall();

    expect(accepted).toBe(true);
    expect(event.prompt).toHaveBeenCalledOnce();
    await expect(promptInstall()).resolves.toBe(false);
  });
});
