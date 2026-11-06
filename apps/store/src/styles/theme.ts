import { createTheme, type Theme } from '@mui/material/styles';

/**
 * E-Shophy Flagship Design System for Partner Stores
 *
 * Primary: #FF7900 (Hover: #E85D04)
 * Secondary / Headings: #172B30
 * Background: #F8FAFC
 * Surface / Paper: #FFFFFF
 * Borders: #E2E8F0
 */

export const storeTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#FF7900',
      dark: '#E85D04',
      light: '#FFA04D',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#172B30',
      light: '#2D4C54',
      dark: '#0E1C20',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#172B30',
      secondary: '#475569',
    },
    divider: '#E2E8F0',
    success: {
      main: '#10B981',
      light: '#ECFDF5',
      dark: '#047857',
    },
    warning: {
      main: '#F59E0B',
      light: '#FFFBEB',
      dark: '#B45309',
    },
    error: {
      main: '#EF4444',
      light: '#FEF2F2',
      dark: '#B91C1C',
    },
    info: {
      main: '#3B82F6',
      light: '#EFF6FF',
      dark: '#1D4ED8',
    },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-0.03em', color: '#172B30' },
    h2: { fontWeight: 800, letterSpacing: '-0.025em', color: '#172B30' },
    h3: { fontWeight: 700, letterSpacing: '-0.02em', color: '#172B30' },
    h4: { fontWeight: 700, letterSpacing: '-0.015em', color: '#172B30' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em', color: '#172B30' },
    h6: { fontWeight: 700, color: '#172B30' },
    subtitle1: { fontWeight: 600, color: '#172B30' },
    subtitle2: { fontWeight: 600, color: '#475569' },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6, color: '#334155' },
    body2: { fontSize: '0.875rem', lineHeight: 1.5, color: '#475569' },
    button: { fontWeight: 700, textTransform: 'none', letterSpacing: '0.01em' },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
    '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
    '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.03)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.07), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    ...Array(19).fill('0 25px 50px -12px rgba(0, 0, 0, 0.15)'),
  ] as any,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 18px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(255, 121, 0, 0.25)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #FF7900 0%, #FF8F26 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #E85D04 0%, #FF7900 100%)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
          border: '1px solid #E2E8F0',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#CBD5E1',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#FF7900',
            borderWidth: '1.5px',
          },
        },
      },
    },
  },
});

