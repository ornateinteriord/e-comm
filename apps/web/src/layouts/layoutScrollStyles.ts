export function isSplitMobilePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/search';
}

/**
 * Computes layout and scroll styles for StorefrontLayout containers so that:
 * - Mobile split views (`/` and `/search`) delegate scrolling to their inner split panels.
 * - All other mobile pages (`/checkout`, `/cart`, `/account`, etc.) keep `<main>` bounded
 *   with `flex: '1 1 0%'` and `minHeight: 0` so `overflowY: 'auto'` always scrolls.
 * - Desktop viewports use natural document scrolling (`overflow: 'visible'`).
 */
export function getMainLayoutStyles(isMobile: boolean, pathname: string) {
  const isSplitMobile = isMobile && isSplitMobilePath(pathname);

  if (!isMobile) {
    return {
      isSplitMobile,
      outer: {
        display: 'flex',
        flexDirection: 'column' as const,
        flex: '1 0 auto',
        height: 'auto',
        minHeight: '100vh',
        maxHeight: 'none',
        width: '100%',
        maxWidth: '100%',
        overflow: 'visible',
      },
      main: {
        flex: '1 0 auto',
        minHeight: 0,
        height: 'auto',
        display: 'flex',
        flexDirection: 'column' as const,
        overflowY: 'visible',
        overflowX: 'visible',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'auto' as const,
      },
      outletWrapper: {
        flex: '1 0 auto',
        minHeight: 0,
        height: 'auto',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column' as const,
        width: '100%',
      },
    };
  }

  return {
    isSplitMobile,
    outer: {
      display: 'flex',
      flexDirection: 'column' as const,
      flex: '1 1 0%',
      height: '100%',
      minHeight: 0,
      maxHeight: '100dvh',
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
    },
    main: {
      flex: '1 1 0%',
      minHeight: 0,
      height: 'auto',
      display: 'flex',
      flexDirection: 'column' as const,
      overflowY: isSplitMobile ? 'hidden' : 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      overscrollBehaviorY: 'contain' as const,
      touchAction: isSplitMobile ? ('auto' as const) : ('pan-y' as const),
    },
    outletWrapper: {
      flex: isSplitMobile ? '1 1 0%' : '1 0 auto',
      minHeight: 0,
      height: isSplitMobile ? '100%' : 'auto',
      overflow: isSplitMobile ? 'hidden' : 'visible',
      display: 'flex',
      flexDirection: 'column' as const,
      width: '100%',
    },
  };
}
