import type { DockerContainer } from './types.js';

type RawDockerContainer = {
  Names?: string[];
  State?: string;
  Health?: { Status?: string };
  StartedAt?: string;
};

function normalizeProxyUrl(dockerProxyUrl: string): string {
  return dockerProxyUrl.replace(/\/+$/, '');
}

function parseContainer(raw: RawDockerContainer): DockerContainer {
  return {
    names: raw.Names ?? [],
    state: raw.State ?? '',
    healthStatus: raw.Health?.Status,
    startedAt: raw.StartedAt,
  };
}

export async function listContainers(dockerProxyUrl: string): Promise<DockerContainer[] | null> {
  const url = `${normalizeProxyUrl(dockerProxyUrl)}/containers/json?all=true`;

  let response: Response;

  try {
    response = await fetch(url, { method: 'GET' });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return null;
  }

  if (!Array.isArray(payload)) {
    return null;
  }

  return payload.map((item) => parseContainer(item as RawDockerContainer));
}

export function indexContainersByName(containers: DockerContainer[]): Map<string, DockerContainer> {
  const byName = new Map<string, DockerContainer>();

  for (const container of containers) {
    for (const name of container.names) {
      const normalized = name.startsWith('/') ? name.slice(1) : name;
      byName.set(normalized, container);
    }
  }

  return byName;
}
