import { expect, type Locator, type Page } from '@playwright/test';

import type { ClientRoutePath } from '../../src/lib/routes/manifest.js';
import { CLIENT_ROUTE_MANIFEST } from '../../src/lib/routes/manifest.js';

/**
 * Routes that have an end-to-end keyboard walk in this suite.
 * Adding a path to CLIENT_ROUTE_MANIFEST without coverage fails coverage.spec.ts.
 */
export const KEYBOARD_ROUTE_COVERAGE: ReadonlySet<ClientRoutePath> = new Set([
  '/',
  '/applications/[id]',
  '/settings',
  '/admin',
]);

export function assertAllRoutesCovered(): void {
  const missing = CLIENT_ROUTE_MANIFEST.filter((route) => !KEYBOARD_ROUTE_COVERAGE.has(route));
  expect(missing, `Keyboard suite missing coverage for: ${missing.join(', ')}`).toEqual([]);
}

/** Interactive elements that must be keyboard-reachable on a covered route. */
const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  'summary',
].join(', ');

export type FocusStop = {
  testId?: string;
  role?: string;
  name?: string | RegExp;
  /** Optional CSS/test-id selector evaluated against the focused element. */
  matches?: string;
};

/**
 * Assert the currently focused element has a visible focus indicator
 * (outline, box-shadow ring, or border change under :focus-visible).
 */
export async function assertVisibleFocusIndicator(page: Page): Promise<void> {
  const indicator = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) {
      return { ok: false, reason: 'focus is on body/document' };
    }

    const styles = getComputedStyle(el);
    const outlineOk =
      styles.outlineStyle !== 'none' &&
      styles.outlineStyle !== '' &&
      Number.parseFloat(styles.outlineWidth) > 0;
    const shadowOk = styles.boxShadow !== 'none' && styles.boxShadow !== '';

    // Some controls only show a ring via outline-color with auto style.
    const autoOutline = styles.outlineStyle === 'auto';

    if (outlineOk || shadowOk || autoOutline) {
      return { ok: true, reason: '' };
    }

    return {
      ok: false,
      reason: `no visible focus indicator on <${el.tagName.toLowerCase()}> (outline=${styles.outlineStyle} ${styles.outlineWidth}, shadow=${styles.boxShadow})`,
    };
  });

  expect(indicator.ok, indicator.reason).toBe(true);
}

/** Fail if any element in the document uses a positive tabindex. */
export async function assertNoPositiveTabindex(page: Page): Promise<void> {
  const offenders = await page.evaluate(() =>
    [...document.querySelectorAll('[tabindex]')]
      .map((el) => ({
        tabIndex: (el as HTMLElement).tabIndex,
        testId: el.getAttribute('data-testid'),
        tag: el.tagName.toLowerCase(),
      }))
      .filter((entry) => entry.tabIndex > 0),
  );

  expect(offenders, `positive tabindex found: ${JSON.stringify(offenders)}`).toEqual([]);
}

/**
 * Collect focusable interactive controls and assert each appears in a Tab walk.
 * Also detects a focus trap (Tab cycling without visiting every control).
 */
export async function assertKeyboardReachability(page: Page): Promise<void> {
  await assertNoPositiveTabindex(page);

  const expected = await page.evaluate((selector) => {
    const isVisible = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    return [...document.querySelectorAll(selector)]
      .filter((el) => {
        if (!isVisible(el)) {
          return false;
        }
        if (el.hasAttribute('disabled')) {
          return false;
        }
        const tabIndex = (el as HTMLElement).tabIndex;
        return tabIndex >= 0;
      })
      .map((el) => ({
        testId: el.getAttribute('data-testid'),
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        name:
          el.getAttribute('aria-label') ||
          (el as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
          el.textContent?.trim().slice(0, 80) ||
          '',
      }));
  }, INTERACTIVE_SELECTOR);

  expect(expected.length, 'expected at least one interactive control').toBeGreaterThan(0);

  // Start from the document so the first Tab reaches the first control.
  await page.locator('body').evaluate((body) => {
    (body as HTMLElement).focus();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  const visited = new Set<string>();
  const identityOf = async () =>
    page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) {
        return 'body';
      }
      const testId = el.getAttribute('data-testid') ?? '';
      const path = [];
      let node: Element | null = el;
      while (node && node !== document.body) {
        const index = node.parentElement ? [...node.parentElement.children].indexOf(node) : 0;
        path.unshift(`${node.tagName.toLowerCase()}:nth(${index})`);
        node = node.parentElement;
      }
      return `${testId}|${path.join('>')}|${el.tagName}`;
    });

  let previous = 'body';
  let stagnant = 0;
  const maxSteps = Math.max(expected.length * 4, 40);

  for (let step = 0; step < maxSteps; step += 1) {
    await page.keyboard.press('Tab');
    const id = await identityOf();

    if (id === 'body') {
      stagnant += 1;
      if (stagnant > 2) {
        break;
      }
      continue;
    }

    if (id === previous) {
      stagnant += 1;
      if (stagnant > 2) {
        throw new Error(`Focus trap detected: Tab did not move focus from ${id}`);
      }
    } else {
      stagnant = 0;
      visited.add(id);
      await assertVisibleFocusIndicator(page);
    }

    previous = id;

    // Once we wrap back to the first visited control after filling the set, stop.
    if (visited.size >= expected.length && step > expected.length) {
      break;
    }
  }

  // Every interactive control must have been focused at least once.
  const missing = await page.evaluate(
    ({ selector, visitedIds }) => {
      const isVisible = (el: Element) => {
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') {
          return false;
        }
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const identity = (el: Element) => {
        const testId = el.getAttribute('data-testid') ?? '';
        const path = [];
        let node: Element | null = el;
        while (node && node !== document.body) {
          const index = node.parentElement ? [...node.parentElement.children].indexOf(node) : 0;
          path.unshift(`${node.tagName.toLowerCase()}:nth(${index})`);
          node = node.parentElement;
        }
        return `${testId}|${path.join('>')}|${el.tagName}`;
      };

      return [...document.querySelectorAll(selector)]
        .filter((el) => {
          if (!isVisible(el) || el.hasAttribute('disabled')) {
            return false;
          }
          return (el as HTMLElement).tabIndex >= 0;
        })
        .map((el) => ({
          id: identity(el),
          testId: el.getAttribute('data-testid'),
          tag: el.tagName.toLowerCase(),
          name: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 60) || '',
        }))
        .filter((entry) => !visitedIds.includes(entry.id));
    },
    { selector: INTERACTIVE_SELECTOR, visitedIds: [...visited] },
  );

  expect(
    missing,
    `interactive controls not reachable by Tab (pointer-only?): ${JSON.stringify(missing)}`,
  ).toEqual([]);
}

/** Tab until the locator is focused, asserting a visible indicator at each stop. */
export async function tabUntilFocused(
  page: Page,
  target: Locator,
  options: { maxTabs?: number } = {},
): Promise<void> {
  const maxTabs = options.maxTabs ?? 60;

  for (let i = 0; i < maxTabs; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) {
      await assertVisibleFocusIndicator(page);
      return;
    }
    await page.keyboard.press('Tab');
    const onBody = await page.evaluate(
      () =>
        document.activeElement === document.body ||
        document.activeElement === document.documentElement,
    );
    if (!onBody) {
      await assertVisibleFocusIndicator(page);
    }
  }

  await expect(target, 'target was not reached by Tab').toBeFocused();
}

/** Press Enter without issuing pointer events. */
export async function activateWithEnter(page: Page): Promise<void> {
  await page.keyboard.press('Enter');
}

/** Press Space without issuing pointer events. */
export async function activateWithSpace(page: Page): Promise<void> {
  await page.keyboard.press('Space');
}

/** Resolve a locator from a focus-stop description. */
export function stopLocator(page: Page, stop: FocusStop): Locator {
  if (stop.testId) {
    return page.getByTestId(stop.testId);
  }
  if (stop.role) {
    return page.getByRole(stop.role as Parameters<Page['getByRole']>[0], {
      name: stop.name,
    });
  }
  if (stop.matches) {
    return page.locator(stop.matches);
  }
  throw new Error('FocusStop requires testId, role, or matches');
}
