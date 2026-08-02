/**
 * One-off viewport reflow audit for G3 (not part of CI).
 * Run from packages/client: node scripts/viewport-audit.mjs
 */
import { chromium, devices } from '@playwright/test';

const baseURL = process.env.PREVIEW_URL ?? 'http://localhost:4174';

function url(path) {
  return new URL(path, baseURL).toString();
}

const catalog = {
  applications: [
    {
      id: 'media',
      name: 'Media',
      description: 'Films and series.',
      url: 'https://media.example/',
      icon: 'media.svg',
      requestable: false,
      services: [
        { id: 'jellyfin', name: 'Jellyfin', hasContainers: true },
        { id: 'db', name: 'Database', hasContainers: true },
      ],
    },
  ],
};

const statusReport = {
  collectedAt: '2026-01-01T12:00:00.000Z',
  applications: [
    {
      id: 'media',
      status: 'down',
      since: '2026-01-01T11:00:00.000Z',
      services: [
        { id: 'jellyfin', status: 'up', since: '2026-01-01T10:00:00.000Z' },
        { id: 'db', status: 'down', since: '2026-01-01T11:00:00.000Z' },
      ],
    },
  ],
};

const alerts = [
  {
    id: 'a1',
    severity: 'warning',
    title: 'Maintenance window',
    body: 'Expect brief downtime tonight.',
    topic: 'ops',
    expiresAt: null,
  },
];

const session = {
  name: 'Test User',
  email: 'test@example.com',
  admin: true,
  logoutUrl: 'https://auth.example/logout',
};

async function stubRoutes(page) {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
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
  await page.route('**/api/admin/alerts**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alerts),
    });
  });
  await page.route('**/api/admin/push/topics', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['ops']),
    });
  });
}

async function overflowCheck(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth > doc.clientWidth,
    };
  });
}

async function auditRoute(page, path, label, setup) {
  await stubRoutes(page);
  if (setup) {
    await setup(page);
  }
  const results = [];

  for (const scenario of [
    { name: '320px', width: 320, height: 568, pageScaleFactor: 1 },
    { name: '200% zoom', width: 320, height: 568, pageScaleFactor: 2 },
  ]) {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: scenario.width,
      height: scenario.height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await session.send('Emulation.setPageScaleFactor', {
      pageScaleFactor: scenario.pageScaleFactor,
    });

    await page.goto(url(path));
    await page.waitForLoadState('networkidle');
    const metrics = await overflowCheck(page);
    results.push({
      scenario: scenario.name,
      ...metrics,
      pass: !metrics.overflow,
    });
  }

  return { route: label, path, results };
}

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 5'] });
const page = await context.newPage();

const routes = [
  { path: '/', label: 'list', setup: null },
  {
    path: '/',
    label: 'grid',
    setup: async (p) => {
      await p.goto(url('/'));
      await p.getByRole('button', { name: 'Grid view' }).click();
    },
  },
  { path: '/apps/media', label: 'detail', setup: null },
  { path: '/settings', label: 'settings', setup: null },
  { path: '/admin', label: 'admin', setup: null },
];

const report = [];
for (const route of routes) {
  report.push(await auditRoute(page, route.path, route.label, route.setup));
}

const viewportMeta = await page.goto(url('/')).then(() =>
  page.evaluate(() => document.querySelector('meta[name="viewport"]')?.getAttribute('content')),
);

await browser.close();

console.log(JSON.stringify({ viewportMeta, routes: report }, null, 2));
