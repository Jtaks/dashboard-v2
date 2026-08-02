import {
  extractHealth,
  normalizeStartedAt,
} from './map-status.js';
import type { ContainerSnapshot, DockerListItem } from './types.js';

export class DockerProxyError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DockerProxyError';
  }
}

export type DockerClientOptions = {
  /** Base URL of the socket proxy, no trailing slash. */
  baseUrl: string;
  /** Injected for tests; defaults to global fetch. */
  fetch?: typeof fetch;
};

/**
 * Strip the leading slash Docker puts on Names entries.
 * Matching is otherwise exact — no compose-project prefix inference.
 */
export function normalizeContainerName(name: string): string {
  return name.startsWith('/') ? name.slice(1) : name;
}

function listUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/containers/json?all=true`;
}

function inspectUrl(baseUrl: string, idOrName: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/containers/${encodeURIComponent(idOrName)}/json`;
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) {
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('fetch failed') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('network') ||
      msg.includes('aggregateerror')
    );
  }
  return false;
}

/**
 * Parse one Engine API list item into a snapshot.
 * `StartedAt` is taken when present on the item (tests / enriched payloads);
 * otherwise left null for the caller to fill via inspect.
 */
export function parseListItem(item: DockerListItem): ContainerSnapshot | null {
  const names = item.Names;
  if (!Array.isArray(names) || names.length === 0 || typeof names[0] !== 'string') {
    return null;
  }
  const name = normalizeContainerName(names[0]);
  if (name.length === 0) {
    return null;
  }
  const state = typeof item.State === 'string' ? item.State : '';
  const health = extractHealth(item.Health, item.Status);
  const startedAt = normalizeStartedAt(item.StartedAt);
  return { name, state, health, startedAt };
}

type InspectState = {
  Status?: string;
  StartedAt?: string;
  Health?: string | { Status?: string } | null;
};

/**
 * Read-only Engine API client. Lists container state/health; never mutates.
 * One {@link listSnapshots} call is one pass over the daemon.
 */
export function createDockerClient(options: DockerClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetch ?? fetch;

  async function listSnapshots(): Promise<Map<string, ContainerSnapshot>> {
    let response: Response;
    try {
      response = await doFetch(listUrl(baseUrl), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      throw new DockerProxyError('Docker proxy unreachable', { cause: err });
    }

    if (!response.ok) {
      throw new DockerProxyError(`Docker proxy returned HTTP ${response.status}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (err) {
      throw new DockerProxyError('Docker proxy returned invalid JSON', { cause: err });
    }

    if (!Array.isArray(body)) {
      throw new DockerProxyError('Docker proxy list response was not an array');
    }

    const map = new Map<string, ContainerSnapshot>();
    for (const raw of body) {
      if (raw === null || typeof raw !== 'object') {
        continue;
      }
      const snapshot = parseListItem(raw as DockerListItem);
      if (snapshot === null) {
        continue;
      }
      // Index every Names entry so an alias still resolves exactly.
      const names = (raw as DockerListItem).Names ?? [];
      for (const entry of names) {
        if (typeof entry === 'string') {
          const key = normalizeContainerName(entry);
          if (key.length > 0 && !map.has(key)) {
            map.set(key, { ...snapshot, name: key });
          }
        }
      }
      if (!map.has(snapshot.name)) {
        map.set(snapshot.name, snapshot);
      }
    }
    return map;
  }

  /**
   * Fill StartedAt for the given names via inspect when the list payload omitted it.
   * Each id/name is inspected at most once. Failures that look like connectivity
   * errors propagate as {@link DockerProxyError}; a 404 leaves startedAt null.
   */
  async function enrichStartedAt(
    snapshots: Map<string, ContainerSnapshot>,
    names: readonly string[],
  ): Promise<void> {
    const pending = [...new Set(names)].filter((name) => {
      const snap = snapshots.get(name);
      return snap !== undefined && snap.startedAt === null;
    });

    await Promise.all(
      pending.map(async (name) => {
        const snap = snapshots.get(name);
        if (!snap) {
          return;
        }
        let response: Response;
        try {
          response = await doFetch(inspectUrl(baseUrl, name), {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
        } catch (err) {
          if (isNetworkFailure(err)) {
            throw new DockerProxyError('Docker proxy unreachable', { cause: err });
          }
          throw err;
        }
        if (response.status === 404) {
          return;
        }
        if (!response.ok) {
          return;
        }
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return;
        }
        if (body === null || typeof body !== 'object') {
          return;
        }
        const state = (body as { State?: InspectState }).State;
        if (!state) {
          return;
        }
        snap.startedAt = normalizeStartedAt(state.StartedAt);
        // Prefer inspect health when list omitted it.
        if (snap.health === null) {
          snap.health = extractHealth(state.Health);
        }
        if (!snap.state && typeof state.Status === 'string') {
          snap.state = state.Status;
        }
      }),
    );
  }

  return { listSnapshots, enrichStartedAt, baseUrl };
}

export type DockerClient = ReturnType<typeof createDockerClient>;
