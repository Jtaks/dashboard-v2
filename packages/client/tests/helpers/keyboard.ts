import { expect, type Locator, type Page } from '@playwright/test';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="link"][href]',
  '[role="checkbox"]:not([aria-disabled="true"])',
  '[role="switch"]:not([aria-disabled="true"])',
  '[role="tab"]:not([aria-disabled="true"])',
].join(', ');

export async function installKeyboardOnlyGuard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const markPointerUse = () => {
      (window as Window & { __dashboardPointerUsed?: boolean }).__dashboardPointerUsed = true;
    };

    for (const eventName of ['mousedown', 'mouseup', 'pointerdown', 'pointerup']) {
      window.addEventListener(eventName, markPointerUse, true);
    }
  });
}

export async function assertNoPointerEventsUsed(page: Page): Promise<void> {
  const used = await page.evaluate(() => {
    return (window as Window & { __dashboardPointerUsed?: boolean }).__dashboardPointerUsed === true;
  });

  expect(used, 'Spec issued a pointer event').toBeFalsy();
}

export async function assertVisibleFocusIndicator(page: Page): Promise<void> {
  const hasIndicator = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) {
      return false;
    }

    if (active.matches(':focus-visible')) {
      return true;
    }

    const style = window.getComputedStyle(active);
    const outlineVisible =
      style.outlineStyle !== 'none' && style.outlineWidth !== '0px' && style.outlineWidth !== '';
    const boxShadowVisible = style.boxShadow !== 'none' && style.boxShadow !== '';

    if (outlineVisible || boxShadowVisible) {
      return true;
    }

    return [...active.querySelectorAll<HTMLElement>('*')].some((child) => {
      const childStyle = window.getComputedStyle(child);
      return (
        childStyle.outlineStyle !== 'none' &&
        childStyle.outlineWidth !== '0px' &&
        childStyle.outlineWidth !== ''
      );
    });
  });

  expect(hasIndicator, 'Focused element lacks a visible focus indicator').toBe(true);
}

export async function assertNoPositiveTabIndex(page: Page): Promise<void> {
  const offenders = await page.evaluate(() => {
    return [...document.querySelectorAll('[tabindex]')]
      .filter((element) => {
        const value = Number.parseInt(element.getAttribute('tabindex') ?? '', 10);
        return Number.isFinite(value) && value > 0;
      })
      .map((element) => {
        const label =
          element.getAttribute('aria-label') ??
          element.getAttribute('data-testid') ??
          element.tagName.toLowerCase();
        return `${label} (tabindex=${element.getAttribute('tabindex')})`;
      });
  });

  expect(offenders, 'Positive tabindex values break natural tab order').toEqual([]);
}

export async function assertNoPointerOnlyControls(page: Page): Promise<void> {
  const offenders = await page.evaluate((selector) => {
    function isNativelyFocusable(element: Element): boolean {
      if (element instanceof HTMLAnchorElement) {
        return Boolean(element.href);
      }

      if (
        element instanceof HTMLButtonElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) {
        return !element.disabled;
      }

      const tabIndex = element.getAttribute('tabindex');
      return tabIndex !== null && tabIndex !== '-1';
    }

    const interactive = [
      ...document.querySelectorAll('[onclick]'),
      ...document.querySelectorAll('[role="button"]'),
    ];

    const unique = [...new Set(interactive)];

    return unique
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return false;
        }

        return !isNativelyFocusable(element);
      })
      .map((element) => {
        const label =
          element.getAttribute('aria-label') ??
          element.getAttribute('data-testid') ??
          element.textContent?.trim().slice(0, 40) ??
          element.tagName.toLowerCase();
        return label;
      });
  }, FOCUSABLE_SELECTOR);

  expect(offenders, 'Interactive control is reachable only by pointer').toEqual([]);
}

export async function assertNoFocusTrap(page: Page): Promise<void> {
  const focusableCount = await page.locator(FOCUSABLE_SELECTOR).evaluateAll((elements) => {
    return elements.filter((element) => {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }).length;
  });

  if (focusableCount === 0) {
    return;
  }

  const maxTabs = Math.min(focusableCount * 2 + 4, 80);
  const visited = new Set<string>();
  let repeatedStreak = 0;
  let lastKey = '';

  for (let step = 0; step < maxTabs; step += 1) {
    await page.keyboard.press('Tab');

    const key = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) {
        return 'none';
      }

      if (active instanceof HTMLInputElement && active.type === 'datetime-local') {
        return 'datetime-local';
      }

      return (
        active.getAttribute('data-testid') ??
        active.getAttribute('aria-label') ??
        `${active.tagName}:${active.textContent?.trim().slice(0, 24) ?? ''}`
      );
    });

    if (key === 'datetime-local') {
      repeatedStreak = 0;
      visited.add(key);
      lastKey = key;
      continue;
    }

    if (key === lastKey) {
      repeatedStreak += 1;
    } else {
      repeatedStreak = 0;
    }

    expect(repeatedStreak, `Focus appears trapped on ${key}`).toBeLessThan(4);
    visited.add(key);
    lastKey = key;
  }

  expect(visited.size, 'Tab navigation never moved focus').toBeGreaterThan(1);
}

export async function tabTo(page: Page, locator: Locator, maxAttempts = 40): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) {
      await assertVisibleFocusIndicator(page);
      return;
    }

    await page.keyboard.press('Tab');
  }

  throw new Error('Could not reach the target element by keyboard');
}

export async function auditKeyboardAccessibility(page: Page): Promise<void> {
  await assertNoPositiveTabIndex(page);
  await assertNoPointerOnlyControls(page);
  await assertNoFocusTrap(page);
}

export async function activateFocused(page: Page, key: 'Enter' | 'Space'): Promise<void> {
  await assertVisibleFocusIndicator(page);
  await page.keyboard.press(key);
}
