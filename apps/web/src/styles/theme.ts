import { createTheme } from '@mui/material/styles';

/**
 * Ornate Flagship Design System
 * Inspired by Apple, Linear, and luxury Scandinavian e-commerce.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f172a',    // Obsidian Slate
      light: '#334155',
      dark: '#020617',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#4f46e5',    // Electric Indigo
      light: '#6366f1',
      dark: '#3730a3',
      contrastText: '#ffffff',
    },
    error: {
      main: '#f43f5e',    // Coral Rose
      light: '#ffe4e6',
      dark: '#be123c',
    },
    warning: {
      main: '#f59e0b',    // Amber
      light: '#fef3c7',
      dark: '#b45309',
    },
    success: {
      main: '#10b981',    // Emerald
      light: '#d1fae5',
      dark: '#047857',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    h1: { fontWeight: 900, letterSpacing: '-0.035em' },
    h2: { fontWeight: 800, letterSpacing: '-0.03em' },
    h3: { fontWeight: 800, letterSpacing: '-0.025em' },
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.015em' },
    h6: { fontWeight: 700, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { fontWeight: 700, textTransform: 'none', letterSpacing: '0.01em' },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
    '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.03)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 22px',
          fontWeight: 700,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: 'none',
          '&:active': {
            transform: 'scale(0.98)',
          },
        },
        containedPrimary: {
          background: '#0f172a',
          '&:hover': {
            background: '#1e293b',
          },
        },
        containedSecondary: {
          background: '#1d4ed8',
          '&:hover': {
            background: '#1e40af',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0 16px 32px -8px rgba(0, 0, 0, 0.08)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 700,
          fontSize: '0.75rem',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 16,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#0f172a',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        },
      },
    },
  },
});
