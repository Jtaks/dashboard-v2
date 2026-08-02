import type { Hono } from 'hono';

export type EnumeratedRoute = {
  method: string;
  path: string;
};

function normalizeRoutePath(basePath: string, path: string): string {
  if (path.startsWith('/api')) {
    return path;
  }

  const combined = `${basePath}${path}`.replace(/\/+/g, '/');
  return combined.endsWith('/') && combined.length > 1
    ? combined.slice(0, -1)
    : combined;
}

export function enumerateApiRoutes(app: Hono): EnumeratedRoute[] {
  const seen = new Set<string>();
  const routes: EnumeratedRoute[] = [];

  for (const route of app.routes) {
    if (route.method === 'ALL' || route.path.includes('*')) {
      continue;
    }

    const path = normalizeRoutePath(route.basePath, route.path);
    if (!path.startsWith('/api')) {
      continue;
    }

    const key = `${route.method} ${path}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    routes.push({ method: route.method, path });
  }

  return routes.sort((left, right) => {
    const pathCompare = left.path.localeCompare(right.path);
    return pathCompare !== 0 ? pathCompare : left.method.localeCompare(right.method);
  });
}

export function instantiatePath(path: string, params: Record<string, string> = {}): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (match, name: string) => {
    return params[name] ?? 'boundary-test-id';
  });
}
