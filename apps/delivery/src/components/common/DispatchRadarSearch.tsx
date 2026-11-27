import { Box, Typography } from '@mui/material';

interface DispatchRadarSearchProps {
  isOnline: boolean;
}

export default function DispatchRadarSearch({ isOnline }: DispatchRadarSearchProps) {
  return (
    <Box
      sx={{
        py: 4.5,
        px: 2.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {/* Large Circular Outline Radar */}
      <Box
        sx={{
          position: 'relative',
          width: 148,
          height: 148,
          borderRadius: '50%',
          border: `2px solid ${isOnline ? 'rgba(255, 121, 0, 0.35)' : '#E5E7EB'}`,
          bgcolor: isOnline ? '#FFFBF7' : '#F8FAFC',
          boxShadow: isOnline
            ? '0 0 0 8px rgba(255, 121, 0, 0.06), inset 0 0 20px rgba(255, 121, 0, 0.08)'
            : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          mb: 2.25,
        }}
      >
        {/* Subtle concentric inner ring & axis crosshairs */}
        <Box
          sx={{
            position: 'absolute',
            width: 92,
            height: 92,
            borderRadius: '50%',
            border: `1px dashed ${isOnline ? 'rgba(255, 121, 0, 0.28)' : '#D1D5DB'}`,
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: `1px solid ${isOnline ? 'rgba(255, 121, 0, 0.16)' : '#E5E7EB'}`,
            pointerEvents: 'none',
          }}
        />

        {/* Rotating Layer (Glowing Trail + Clockwise Stick) */}
        <Box
          className={isOnline ? 'radar-sweep-arm' : undefined}
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        >
          {/* Optional Glowing Trail Wedge (trailing counter-clockwise behind top 0deg arm) */}
          {isOnline && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background:
                  'conic-gradient(from 0deg, rgba(255, 121, 0, 0) 275deg, rgba(255, 121, 0, 0.12) 325deg, rgba(255, 121, 0, 0.34) 360deg)',
              }}
            />
          )}

          {/* One Stick / Line from Center Pivot Outward */}
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: '50%',
              width: 2.5,
              height: '49%',
              transform: 'translateX(-50%)',
              borderRadius: '999px',
              background: isOnline
                ? 'linear-gradient(to top, #EA580C 0%, #FF7900 75%, #FDBA74 100%)'
                : '#94A3B8',
              boxShadow: isOnline ? '0 0 10px rgba(255, 121, 0, 0.7)' : 'none',
            }}
          />
        </Box>

        {/* Center Pivot Point */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            bgcolor: isOnline ? '#FF7900' : '#94A3B8',
            border: '2.5px solid #FFFFFF',
            boxShadow: isOnline
              ? '0 0 0 4px rgba(255, 121, 0, 0.24)'
              : '0 0 0 3px rgba(148, 163, 184, 0.2)',
          }}
        />
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#111827', mb: 0.5 }}>
        {isOnline ? 'Searching for assigned orders' : 'Dispatch Radar Paused'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
        {isOnline
          ? 'Stay online — newly assigned deliveries will ring loudly and open automatically here.'
          : 'Toggle Online in the top bar to start scanning for incoming delivery assignments.'}
      </Typography>
    </Box>
  );
}
