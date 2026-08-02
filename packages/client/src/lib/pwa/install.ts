type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listeners: Array<(available: boolean) => void> = [];

function notifyListeners() {
  const available = deferredPrompt !== null;
  for (const listener of listeners) {
    listener(available);
  }
}

export function captureBeforeInstallPrompt(event: Event): void {
  if ('preventDefault' in event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  deferredPrompt = event as BeforeInstallPromptEvent;
  notifyListeners();
}

export function subscribeInstallAvailability(listener: (available: boolean) => void): () => void {
  listeners.push(listener);
  listener(deferredPrompt !== null);

  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
  };
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }

  const prompt = deferredPrompt;
  deferredPrompt = null;
  notifyListeners();

  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  return outcome === 'accepted';
}
