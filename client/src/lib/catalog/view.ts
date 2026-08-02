import { STORAGE_KEYS } from '@dashboard/shared';

export const CATALOG_VIEWS = ['list', 'grid'] as const;
export type CatalogViewMode = (typeof CATALOG_VIEWS)[number];

/** Default when the key is missing, empty, or unrecognised. */
export const DEFAULT_CATALOG_VIEW: CatalogViewMode = 'list';

export function isCatalogViewMode(value: unknown): value is CatalogViewMode {
  return value === 'list' || value === 'grid';
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * Read `dashboard.view`. Missing, empty, or unrecognised values fall back to list
 * and repair the stored value rather than throwing.
 */
export function readCatalogView(): CatalogViewMode {
  const store = storage();
  if (!store) {
    return DEFAULT_CATALOG_VIEW;
  }

  try {
    const raw = store.getItem(STORAGE_KEYS.view);
    if (isCatalogViewMode(raw)) {
      return raw;
    }
    writeCatalogView(DEFAULT_CATALOG_VIEW);
    return DEFAULT_CATALOG_VIEW;
  } catch {
    return DEFAULT_CATALOG_VIEW;
  }
}

/** Persist the catalog presentation. Write failures are ignored (quota, private mode). */
export function writeCatalogView(view: CatalogViewMode): void {
  const store = storage();
  if (!store) {
    return;
  }

  try {
    store.setItem(STORAGE_KEYS.view, view);
  } catch {
    // localStorage may reject writes; preference stays in-memory only.
  }
}
