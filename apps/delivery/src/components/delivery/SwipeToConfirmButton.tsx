import { useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { KeyboardDoubleArrowRight as SlideArrowIcon } from '@mui/icons-material';

interface SwipeToConfirmButtonProps {
  label: string;
  loadingLabel?: string;
  disabled?: boolean;
  isLoading?: boolean;
  color?: 'orange' | 'green' | 'blue' | 'slate';
  onConfirm: () => void;
}

const COLOR_MAP = {
  orange: { trackBg: '#FF7900', thumbColor: '#EA580C' },
  green: { trackBg: '#059669', thumbColor: '#047857' },
  blue: { trackBg: '#1D4ED8', thumbColor: '#1E40AF' },
  slate: { trackBg: '#111827', thumbColor: '#111827' },
};

export default function SwipeToConfirmButton({
  label,
  loadingLabel = 'Updating...',
  disabled = false,
  isLoading = false,
  color = 'orange',
  onConfirm,
}: SwipeToConfirmButtonProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const palette = COLOR_MAP[color];
  const isBlocked = disabled || isLoading;
  const THUMB_SIZE = 44;
  const PADDING = 4;

  const getMaxSlide = () => {
    const width = trackRef.current?.clientWidth ?? 280;
    return Math.max(80, width - THUMB_SIZE - PADDING * 2);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isBlocked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || startXRef.current === null || isBlocked) return;
    const maxSlide = getMaxSlide();
    const nextX = Math.max(0, Math.min(maxSlide, e.clientX - startXRef.current));
    setDragX(nextX);
  };

  const finishDrag = () => {
    if (!dragging) return;
    const maxSlide = getMaxSlide();
    const reachedThreshold = dragX >= maxSlide * 0.72;
    setDragging(false);
    startXRef.current = null;
    setDragX(0);
    if (reachedThreshold && !isBlocked) {
      onConfirm();
    }
  };

  return (
    <Box
      ref={trackRef}
      data-swipe-confirm="true"
      role="button"
      tabIndex={isBlocked ? -1 : 0}
      aria-label={label}
      onKeyDown={(e) => {
        if (!isBlocked && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onConfirm();
        }
      }}
      sx={{
        position: 'relative',
        height: 52,
        borderRadius: 2.5,
        backgroundColor: isBlocked ? '#D1D5DB' : palette.trackBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pl: 7,
        pr: 2,
        userSelect: 'none',
        touchAction: 'none',
        overflow: 'hidden',
      }}
    >
      <Typography
        variant="button"
        noWrap
        sx={{
          color: isBlocked ? '#6B7280' : '#FFFFFF',
          fontWeight: 700,
          fontSize: '0.85rem',
          letterSpacing: '0.01em',
          textTransform: 'none',
          opacity: dragging ? Math.max(0.25, 1 - dragX / 140) : 1,
          pointerEvents: 'none',
        }}
      >
        {isLoading ? loadingLabel : label}
      </Typography>

      <Box
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        sx={{
          position: 'absolute',
          left: PADDING,
          top: PADDING,
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: 2,
          bgcolor: '#FFFFFF',
          color: isBlocked ? '#9CA3AF' : palette.thumbColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isBlocked ? 'not-allowed' : dragging ? 'grabbing' : 'grab',
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.16)',
        }}
      >
        {isLoading ? (
          <CircularProgress size={18} color="inherit" />
        ) : (
          <SlideArrowIcon fontSize="small" />
        )}
      </Box>
    </Box>
  );
}
