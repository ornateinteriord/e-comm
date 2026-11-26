import { createTheme, type Theme } from '@mui/material/styles';

export const deliveryTheme: Theme = createTheme({
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
    h4: { fontWeight: 800, letterSpacing: '-0.02em', color: '#172B30' },
    h5: { fontWeight: 800, letterSpacing: '-0.015em', color: '#172B30' },
    h6: { fontWeight: 700, color: '#172B30' },
    subtitle1: { fontWeight: 700, color: '#172B30' },
    subtitle2: { fontWeight: 600, color: '#475569' },
    button: { fontWeight: 700, textTransform: 'none', letterSpacing: '0.01em' },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          minHeight: 42,
          padding: '8px 18px',
          boxShadow: 'none',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #FF7900 0%, #FF8F26 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #E85D04 0%, #FF7900 100%)',
            boxShadow: '0 4px 12px rgba(255, 121, 0, 0.25)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
  },
});
