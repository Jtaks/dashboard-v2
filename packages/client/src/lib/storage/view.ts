import { STORAGE_KEY_VIEW } from '@dashboard/shared';

export type CatalogView = 'list' | 'grid';

export function parseCatalogView(value: string | null): CatalogView {
  if (value === 'list' || value === 'grid') {
    return value;
  }

  return 'list';
}

export function readCatalogView(storage: Storage = localStorage): CatalogView {
  const stored = storage.getItem(STORAGE_KEY_VIEW);
  const view = parseCatalogView(stored);

  if (stored !== view) {
    writeCatalogView(view, storage);
  }

  return view;
}

export function writeCatalogView(view: CatalogView, storage: Storage = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY_VIEW, view);
  } catch {
    // Ignore quota and privacy-mode failures.
  }
}
