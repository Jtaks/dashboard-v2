import type { Application, Catalog, Session } from '@dashboard/shared';
import { expect, test } from '@playwright/test';

import { stubSession as stubAuthenticatedSession, stubStatus } from './helpers/stubs.js';

const session: Session = {
  name: 'Test User',
  email: 'test@example.com',
  admin: false,
  logoutUrl: 'https://auth.example/logout',
};

const applications: Application[] = [
  {
    id: 'app-one',
    name: 'App One',
    description: 'First application',
    url: 'https://app-one.example/',
    icon: 'app-one.svg',
    requestable: false,
    services: [],
  },
  {
    id: 'app-two',
    name: 'App Two',
    description: 'Second application',
    url: 'https://app-two.example/',
    icon: 'app-two.svg',
    requestable: false,
    services: [],
  },
  {
    id: 'app-three',
    name: 'App Three',
    description: 'Third application',
    url: 'https://app-three.example/',
    icon: 'app-three.svg',
    requestable: false,
    services: [],
  },
];

const populatedCatalog: Catalog = { applications };

async function stubSession(page: import('@playwright/test').Page) {
  await stubAuthenticatedSession(page, session);
  await stubStatus(page);
}

async function tabTo(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) {
      return;
    }

    await page.keyboard.press('Tab');
  }

  throw new Error('Could not reach the target element by keyboard');
}

test.describe('catalog list view', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('renders one row per application with name and description', async ({ page }) => {
    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Applications', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'App One', level: 2 })).toBeVisible();
    await expect(page.getByText('First application')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'App Two', level: 2 })).toBeVisible();
    await expect(page.getByText('Second application')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'App Three', level: 2 })).toBeVisible();
    await expect(page.getByText('Third application')).toBeVisible();
    await expect(page.locator('.catalog-row')).toHaveCount(3);
  });

  test('renders the empty state for a catalog with no applications', async ({ page }) => {
    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applications: [] }),
      });
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'No applications' })).toBeVisible();
    await expect(
      page.getByText('You do not have access to any applications yet.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).not.toBeVisible();
  });

  test('renders the error state with retry for a failed catalog request', async ({ page }) => {
    let requestCount = 0;

    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      requestCount += 1;

      if (requestCount === 1) {
        await route.fulfill({
          status: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'internal_error' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Could not load applications' })).toBeVisible();
    await expect(
      page.getByText('Something went wrong while loading your applications.'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No applications' })).not.toBeVisible();

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByRole('heading', { name: 'App One', level: 2 })).toBeVisible();
    expect(requestCount).toBe(2);
  });

  test('renders the loading state while the catalog request is in flight', async ({ page }) => {
    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.goto('/');

    const loading = page.getByText('Loading applications…');
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('heading', { name: 'App One', level: 2 })).not.toBeVisible();
  });

  test('navigates to the application URL when the icon link is activated', async ({ page }) => {
    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applications: [applications[0]],
        }),
      });
    });
    await page.route('https://app-one.example/**', async (route) => {
      await route.fulfill({ status: 200, body: 'ok' });
    });

    await page.goto('/');

    await page.getByRole('link', { name: 'Open App One' }).click();
    await expect(page).toHaveURL('https://app-one.example/');
  });

  test('reaches and activates each icon link by keyboard alone', async ({ page }) => {
    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });
    await page.route('https://app-one.example/**', async (route) => {
      await route.fulfill({ status: 200, body: 'ok' });
    });
    await page.route('https://app-two.example/**', async (route) => {
      await route.fulfill({ status: 200, body: 'ok' });
    });
    await page.route('https://app-three.example/**', async (route) => {
      await route.fulfill({ status: 200, body: 'ok' });
    });

    await page.goto('/');

    const iconLinks = [
      page.getByRole('link', { name: 'Open App One' }),
      page.getByRole('link', { name: 'Open App Two' }),
      page.getByRole('link', { name: 'Open App Three' }),
    ];

    await tabTo(page, iconLinks[0]);
    await Promise.all([
      page.waitForURL('https://app-one.example/'),
      page.keyboard.press('Enter'),
    ]);

    await page.goto('/');

    await tabTo(page, iconLinks[1]);
    await Promise.all([
      page.waitForURL('https://app-two.example/'),
      page.keyboard.press('Enter'),
    ]);

    await page.goto('/');

    await tabTo(page, iconLinks[2]);
    await Promise.all([
      page.waitForURL('https://app-three.example/'),
      page.keyboard.press('Enter'),
    ]);
  });
});

test.describe('catalog grid view', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('switches between list and grid without refetching the catalog', async ({ page }) => {
    let catalogRequestCount = 0;

    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      catalogRequestCount += 1;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.goto('/');

    await expect(page.locator('.catalog-row')).toHaveCount(3);
    await expect(page.locator('.catalog-tile')).toHaveCount(0);
    expect(catalogRequestCount).toBe(1);

    await page.getByRole('button', { name: 'Grid view' }).click();

    await expect(page.locator('.catalog-tile')).toHaveCount(3);
    await expect(page.locator('.catalog-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(catalogRequestCount).toBe(1);

    await page.getByRole('button', { name: 'List view' }).click();

    await expect(page.locator('.catalog-row')).toHaveCount(3);
    await expect(page.locator('.catalog-tile')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(catalogRequestCount).toBe(1);
  });

  test('persists the chosen rendering across reload', async ({ page }) => {
    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.goto('/');

    await page.getByRole('button', { name: 'Grid view' }).click();
    await expect(page.locator('.catalog-tile')).toHaveCount(3);

    await page.reload();

    await expect(page.locator('.catalog-tile')).toHaveCount(3);
    await expect(page.locator('.catalog-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const storedView = await page.evaluate(() => localStorage.getItem('dashboard.view'));
    expect(storedView).toBe('grid');
  });

  test('falls back to list for an unrecognised stored value', async ({ page }) => {
    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('dashboard.view', 'table');
    });

    await page.goto('/');

    await expect(page.locator('.catalog-row')).toHaveCount(3);
    await expect(page.locator('.catalog-tile')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const storedView = await page.evaluate(() => localStorage.getItem('dashboard.view'));
    expect(storedView).toBe('list');
  });

  test('switches the rendering from the keyboard alone', async ({ page }) => {
    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.goto('/');

    const gridButton = page.getByRole('button', { name: 'Grid view' });
    const listButton = page.getByRole('button', { name: 'List view' });

    await tabTo(page, gridButton);
    await page.keyboard.press('Enter');

    await expect(page.locator('.catalog-tile')).toHaveCount(3);
    await expect(gridButton).toHaveAttribute('aria-pressed', 'true');

    await tabTo(page, listButton);
    await page.keyboard.press('Enter');

    await expect(page.locator('.catalog-row')).toHaveCount(3);
    await expect(listButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('renders the error state while grid is the active presentation', async ({ page }) => {
    let requestCount = 0;

    await stubSession(page);
    await page.addInitScript(() => {
      localStorage.setItem('dashboard.view', 'grid');
    });
    await page.route('**/api/catalog', async (route) => {
      requestCount += 1;

      if (requestCount === 1) {
        await route.fulfill({
          status: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'internal_error' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Could not load applications' })).toBeVisible();
    await expect(page.locator('.catalog-tile')).toHaveCount(0);

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.locator('.catalog-tile')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

test.describe('catalog search', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    });
  });

  test('filters applications as the query changes without refetching the catalog', async ({ page }) => {
    let catalogRequestCount = 0;

    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      catalogRequestCount += 1;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.goto('/');

    await expect(page.locator('.catalog-row')).toHaveCount(3);
    expect(catalogRequestCount).toBe(1);

    const search = page.getByRole('searchbox', { name: 'Search applications' });
    await search.fill('one');

    await expect(page.locator('.catalog-row')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'App One', level: 2 })).toBeVisible();
    expect(catalogRequestCount).toBe(1);

    await search.fill('second');

    await expect(page.locator('.catalog-row')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'App Two', level: 2 })).toBeVisible();
    expect(catalogRequestCount).toBe(1);
  });

  test('renders the no-results state and clears the query from the control', async ({ page }) => {
    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.goto('/');

    const search = page.getByRole('searchbox', { name: 'Search applications' });
    await search.fill('missing');

    await expect(page.getByRole('heading', { name: 'No matching applications' })).toBeVisible();
    await expect(
      page.getByText('No application names or descriptions contain your search.'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No applications' })).not.toBeVisible();
    await expect(page.locator('.catalog-row')).toHaveCount(0);

    await page.getByRole('button', { name: 'Clear search' }).click();

    await expect(page.locator('.catalog-row')).toHaveCount(3);
    await expect(search).toHaveValue('');
  });

  test('keeps the active query when switching between list and grid', async ({ page }) => {
    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.goto('/');

    const search = page.getByRole('searchbox', { name: 'Search applications' });
    await search.fill('three');

    await expect(page.locator('.catalog-row')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'App Three', level: 2 })).toBeVisible();

    await page.getByRole('button', { name: 'Grid view' }).click();

    await expect(page.locator('.catalog-tile')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'App Three', level: 2 })).toBeVisible();
    await expect(search).toHaveValue('three');

    await page.getByRole('button', { name: 'List view' }).click();

    await expect(page.locator('.catalog-row')).toHaveCount(1);
    await expect(search).toHaveValue('three');
  });

  test('resets the query on reload', async ({ page }) => {
    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.goto('/');

    const search = page.getByRole('searchbox', { name: 'Search applications' });
    await search.fill('one');
    await expect(page.locator('.catalog-row')).toHaveCount(1);

    await page.reload();

    await expect(search).toHaveValue('');
    await expect(page.locator('.catalog-row')).toHaveCount(3);
  });

  test('clears the query from the keyboard alone', async ({ page }) => {
    await stubSession(page);
    await page.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(populatedCatalog),
      });
    });

    await page.goto('/');

    const search = page.getByRole('searchbox', { name: 'Search applications' });
    await search.fill('missing');

    await expect(page.getByRole('heading', { name: 'No matching applications' })).toBeVisible();

    await tabTo(page, page.getByRole('button', { name: 'Clear search' }));
    await page.keyboard.press('Enter');

    await expect(page.locator('.catalog-row')).toHaveCount(3);
    await expect(search).toHaveValue('');
  });
});
