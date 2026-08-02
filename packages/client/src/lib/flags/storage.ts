import { STORAGE_KEY_FLAGS } from '@dashboard/shared';

export function readFlags(storage: Storage = localStorage): Record<string, boolean> {
  try {
    const raw = storage.getItem(STORAGE_KEY_FLAGS);
    if (!raw) {
      return {};
    }

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const result: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'boolean') {
        result[key] = value;
      }
    }

    return result;
  } catch {
    return {};
  }
}

export function resolveFlag(flags: Record<string, boolean>, name: string): boolean {
  return flags[name] === true;
}

export function writeFlag(name: string, value: boolean, storage: Storage = localStorage): void {
  const flags = readFlags(storage);
  flags[name] = value;

  try {
    storage.setItem(STORAGE_KEY_FLAGS, JSON.stringify(flags));
  } catch {
    // Ignore quota and privacy-mode failures.
  }
}
