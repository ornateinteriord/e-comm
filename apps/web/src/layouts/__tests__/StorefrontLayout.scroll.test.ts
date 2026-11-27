import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getMainLayoutStyles, isSplitMobilePath } from '../layoutScrollStyles';

const ALL_NON_SPLIT_ROUTES = [
  '/checkout',
  '/cart',
  '/products/sample-product',
  '/categories/electronics',
  '/orders',
  '/orders/ord-123',
  '/wishlist',
  '/wallet',
  '/account',
  '/login',
  '/register',
  '/payment/return',
  '/privacy-policy',
  '/terms-and-conditions',
  '/contact',
  '/contact-us',
  '/delivery',
  '/data-deletion-requests',
  '/whatsapp-test',
  '/does-not-exist',
];

const SPLIT_ROUTES = ['/', '/search'];

describe('StorefrontLayout scrolling contract across all pages', () => {
  it('enables bounded scrollable main container on mobile for every non-split page', () => {
    for (const route of ALL_NON_SPLIT_ROUTES) {
      expect(isSplitMobilePath(route)).toBe(false);
      const styles = getMainLayoutStyles(true, route);

      // Flex-shrink MUST remain 1 with 0% basis so <main> does not expand past 100dvh
      expect(styles.main.flex).toBe('1 1 0%');
      expect(styles.main.minHeight).toBe(0);
      expect(styles.main.overflowY).toBe('auto');
      expect(styles.main.overflowX).toBe('hidden');
      expect(styles.main.touchAction).toBe('pan-y');

      // Outlet wrapper grows naturally with page content and stays visible inside <main>
      expect(styles.outletWrapper.flex).toBe('1 0 auto');
      expect(styles.outletWrapper.overflow).toBe('visible');
      expect(styles.outletWrapper.height).toBe('auto');

      // Outer app shell stays bounded so header and bottom nav remain pinned
      expect(styles.outer.overflow).toBe('hidden');
    }
  });

  it('delegates scrolling to inner split panels on mobile home and search routes', () => {
    for (const route of SPLIT_ROUTES) {
      expect(isSplitMobilePath(route)).toBe(true);
      const styles = getMainLayoutStyles(true, route);

      expect(styles.isSplitMobile).toBe(true);
      expect(styles.main.flex).toBe('1 1 0%');
      expect(styles.main.minHeight).toBe(0);
      expect(styles.main.overflowY).toBe('hidden');
      expect(styles.outletWrapper.height).toBe('100%');
      expect(styles.outletWrapper.overflow).toBe('hidden');
    }
  });

  it('uses natural document scrolling on desktop across every route', () => {
    for (const route of [...SPLIT_ROUTES, ...ALL_NON_SPLIT_ROUTES]) {
      const styles = getMainLayoutStyles(false, route);

      expect(styles.outer.height).toBe('auto');
      expect(styles.outer.overflow).toBe('visible');
      expect(styles.main.overflowY).toBe('visible');
      expect(styles.main.overflowX).toBe('visible');
      expect(styles.outletWrapper.overflow).toBe('visible');
    }
  });

  it('ensures no page component locks root viewport height or hides vertical overflow', () => {
    const pagesDir = path.resolve(__dirname, '../../pages');
    const pageFiles = fs
      .readdirSync(pagesDir)
      .filter((f) => f.endsWith('.tsx'));

    expect(pageFiles.length).toBeGreaterThan(10);

    for (const file of pageFiles) {
      const src = fs.readFileSync(path.join(pagesDir, file), 'utf8');
      expect(src, `${file} should not lock root height to 100vh/100dvh`).not.toMatch(
        /height:\s*['"]100d?vh['"]/,
      );
      expect(src, `${file} should not disable vertical overflow`).not.toMatch(
        /overflowY:\s*['"]hidden['"]/,
      );
    }
  });
});
