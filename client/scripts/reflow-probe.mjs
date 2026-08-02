/**
 * One-off G3 reflow probe — not part of the CI suite.
 * Usage (from client/): node scripts/reflow-probe.mjs
 * Expects preview at http://127.0.0.1:4173 (starts build+preview if needed).
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'http://127.0.0.1:4173';

const sessionBody = {
  name: 'Test User',
  email: 'test@example.com',
  admin: true,
  logoutUrl: 'https://auth.example.test/logout',
};

const catalog = {
  applications: [
    {
      id: 'media',
      name: 'Media',
      description: 'Films and series with a slightly longer description for wrap checks.',
      url: 'https://media.example.test/',
      icon: 'media.svg',
      requestable: false,
      services: [
        { id: 'jellyfin', name: 'Jellyfin', hasContainers: true },
        { id: 'postgres', name: 'Postgres', hasContainers: true },
        { id: 'docs', name: 'Docs link', hasContainers: false },
      ],
    },
  ],
};

const statusReport = {
  collectedAt: '2026-01-01T12:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'degraded',
      since: '2026-01-01T06:00:00.000Z',
      services: [
        { id: 'jellyfin', status: 'up', since: '2026-01-01T00:00:00.000Z' },
        { id: 'postgres', status: 'degraded', since: '2026-01-01T06:00:00.000Z' },
        { id: 'docs', status: null, since: null },
      ],
    },
  ],
};

const alerts = [
  {
    id: 'a1',
    title: 'Maintenance window',
    severity: 'warning',
    body: 'Tonight.',
    topic: '*',
    endsAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok || res.status === 200) return;
    } catch {
      /* retry */
    }
    await sleep(1000);
  }
  throw new Error('preview server did not become ready');
}

async function stubApi(page) {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionBody),
    });
  });
  await page.route('**/api/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catalog),
    });
  });
  await page.route('**/api/status', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statusReport),
    });
  });
  await page.route('**/api/alerts', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alerts),
    });
  });
  await page.route('**/api/topics', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['*']),
    });
  });
  await page.route('**/api/push/vapid-public-key', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey:
          'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      }),
    });
  });
}

async function measure(page, label) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      clientWidth: doc.clientWidth,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      viewportMeta:
        document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? null,
    };
  });
  const overflow = metrics.scrollWidth > metrics.clientWidth + 1;
  return { label, ...metrics, overflow };
}

async function main() {
  let child = null;
  try {
    let ready = false;
    try {
      const res = await fetch(BASE);
      ready = res.ok || res.status === 200 || res.status === 404;
    } catch {
      ready = false;
    }

    if (!ready) {
      child = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: true,
      });
      await waitForServer();
    }

    const browser = await chromium.launch();
    const results = [];

    const routes = [
      { name: 'list', path: '/', prep: async () => {} },
      {
        name: 'grid',
        path: '/',
        prep: async (page) => {
          await page.addInitScript(() => localStorage.setItem('dashboard.view', 'grid'));
        },
      },
      { name: 'detail', path: '/applications/media', prep: async () => {} },
      { name: 'settings', path: '/settings', prep: async () => {} },
      { name: 'admin', path: '/admin', prep: async () => {} },
    ];

    for (const route of routes) {
      {
        const context = await browser.newContext({ viewport: { width: 320, height: 720 } });
        const page = await context.newPage();
        await stubApi(page);
        await route.prep(page);
        await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' });
        results.push(await measure(page, `${route.name} @ 320px`));
        await context.close();
      }
      {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 800 },
        });
        const page = await context.newPage();
        await stubApi(page);
        await route.prep(page);
        await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => {
          document.body.style.zoom = '200%';
        });
        const metrics = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          return {
            clientWidth: doc.clientWidth,
            scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
            innerWidth: window.innerWidth,
            zoom: document.body.style.zoom,
          };
        });
        results.push({
          label: `${route.name} @ 200% zoom (1280→zoom)`,
          ...metrics,
          overflow: metrics.scrollWidth > metrics.clientWidth + 1,
        });
        await context.close();
      }
    }

    {
      const context = await browser.newContext({
        viewport: { width: 800, height: 600 },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await stubApi(page);
      await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
      const motion = await page.evaluate(() => {
        const el = document.querySelector('.flag-toggle-track') ?? document.body;
        const cs = getComputedStyle(el);
        return {
          transitionDuration: cs.transitionDuration,
          animationDuration: cs.animationDuration,
        };
      });
      results.push({ label: 'reduced-motion settings toggle', ...motion });
      await context.close();
    }

    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await stubApi(page);
      await page.goto(`${BASE}/`);
      const meta = await page.evaluate(
        () => document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? null,
      );
      results.push({ label: 'viewport-meta', content: meta });
      await context.close();
    }

    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  } finally {
    if (child && !child.killed) child.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
