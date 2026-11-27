import { useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { ArrowDownward as PullArrowIcon } from '@mui/icons-material';

interface PullToRefreshContainerProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const THRESHOLD_PX = 58;
const MAX_PULL_PX = 84;

export default function PullToRefreshContainer({
  onRefresh,
  children,
}: PullToRefreshContainerProps) {
  const startYRef = useRef<number | null>(null);
  const [pullPx, setPullPx] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canStartPull = (target: EventTarget | null) => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop > 2 || isRefreshing) return false;
    if (target instanceof Element) {
      if (target.closest('.maplibregl-map, [data-swipe-confirm], input, textarea, canvas, [role="dialog"]')) {
        return false;
      }
    }
    return true;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1 || !canStartPull(e.target)) {
      startYRef.current = null;
      return;
    }
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startYRef.current === null || isRefreshing) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop > 2) {
      startYRef.current = null;
      setPullPx(0);
      return;
    }
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 6) {
      setPullPx(Math.min(MAX_PULL_PX, delta * 0.45));
    } else {
      setPullPx(0);
    }
  };

  const handleTouchEnd = async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    if (pullPx >= THRESHOLD_PX && !isRefreshing) {
      setIsRefreshing(true);
      setPullPx(44);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullPx(0);
      }
      return;
    }
    setPullPx(0);
  };

  const showIndicator = pullPx > 10 || isRefreshing;

  return (
    <Box
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      sx={{ position: 'relative', minHeight: '100%' }}
    >
      {showIndicator && (
        <Box
          sx={{
            height: pullPx,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            overflow: 'hidden',
            color: '#4B5563',
            transition: isRefreshing || pullPx === 0 ? 'height 180ms ease' : 'none',
          }}
        >
          {isRefreshing ? (
            <CircularProgress size={16} color="primary" />
          ) : (
            <PullArrowIcon
              fontSize="small"
              sx={{
                transform: pullPx >= THRESHOLD_PX ? 'rotate(180deg)' : 'none',
                transition: 'transform 150ms ease',
                color: pullPx >= THRESHOLD_PX ? '#FF7900' : '#64748B',
              }}
            />
          )}
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {isRefreshing
              ? 'Refreshing...'
              : pullPx >= THRESHOLD_PX
                ? 'Release to refresh'
                : 'Pull down to refresh'}
          </Typography>
        </Box>
      )}
      {children}
    </Box>
  );
}
