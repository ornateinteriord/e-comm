import { Breadcrumbs, Link, Typography, Box, useTheme, type SxProps, type Theme } from '@mui/material';
import { NavigateNext as NextIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router';

export interface BreadcrumbItem {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface PageBreadcrumbsProps {
  items: BreadcrumbItem[];
  compact?: boolean;
  tone?: 'auto' | 'light-on-dark';
  sx?: SxProps<Theme>;
}

export default function PageBreadcrumbs({
  items,
  compact = false,
  tone = 'auto',
  sx,
}: PageBreadcrumbsProps) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const isDarkSurface = tone === 'light-on-dark';

  const linkColor = isDarkSurface
    ? 'rgba(255, 255, 255, 0.72)'
    : isLight
      ? '#64748B'
      : '#94A3B8';

  const currentColor = isDarkSurface
    ? '#FFFFFF'
    : isLight
      ? '#172B30'
      : '#F8FAFC';

  const separatorColor = isDarkSurface
    ? 'rgba(255, 255, 255, 0.45)'
    : isLight
      ? '#94A3B8'
      : '#64748B';

  const fontSize = compact ? '0.72rem' : '0.84rem';

  return (
    <Box component="nav" aria-label="breadcrumb" sx={{ mb: compact ? 0 : 2.5, ...sx }}>
      <Breadcrumbs
        separator={<NextIcon sx={{ fontSize: compact ? 13 : 15, color: separatorColor }} />}
        sx={{
          '& .MuiBreadcrumbs-ol': {
            flexWrap: compact ? 'nowrap' : 'wrap',
            alignItems: 'center',
          },
          '& .MuiBreadcrumbs-separator': {
            mx: compact ? 0.35 : 0.75,
          },
        }}
      >
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;

          if (isLast) {
            return (
              <Typography
                key={`${item.label}-${idx}`}
                noWrap={compact}
                sx={{
                  fontSize,
                  fontWeight: 700,
                  color: currentColor,
                  maxWidth: compact ? 160 : { xs: 200, sm: 360, md: 'none' },
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </Typography>
            );
          }

          if (item.to) {
            return (
              <Link
                key={`${item.label}-${idx}`}
                component={RouterLink}
                to={item.to}
                underline="hover"
                sx={{
                  fontSize,
                  fontWeight: 600,
                  color: linkColor,
                  whiteSpace: 'nowrap',
                  '&:hover': { color: '#FF7900' },
                }}
              >
                {item.label}
              </Link>
            );
          }

          if (item.onClick) {
            return (
              <Link
                key={`${item.label}-${idx}`}
                component="button"
                type="button"
                onClick={item.onClick}
                underline="hover"
                sx={{
                  fontSize,
                  fontWeight: 600,
                  color: linkColor,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: 0,
                  bgcolor: 'transparent',
                  p: 0,
                  fontFamily: 'inherit',
                  '&:hover': { color: '#FF7900' },
                }}
              >
                {item.label}
              </Link>
            );
          }

          return (
            <Typography
              key={`${item.label}-${idx}`}
              sx={{ fontSize, fontWeight: 600, color: linkColor, whiteSpace: 'nowrap' }}
            >
              {item.label}
            </Typography>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
}
