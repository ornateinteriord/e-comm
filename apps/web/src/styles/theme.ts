import { createTheme, type Theme } from '@mui/material/styles';

/**
 * E-Shophy Flagship Design System
 * 
 * Palette:
 * - Primary buttons:   #FF7900 (hover: #E85D04)
 * - Headings:          #172B30
 * - Body text:         #374151
 * - Main background:   #FFFFFF
 * - Section background:#F5F6F7
 * - Borders:           #E5E7EB
 * - Discount labels:   #D92D20
 */

export const getTheme = (mode: 'light' | 'dark' = 'light'): Theme => {
  const isLight = mode === 'light';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#FF7900',      // Primary buttons
        dark: '#E85D04',      // Button hover
        light: '#FFA04D',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#172B30',      // Headings & Brand Deep Teal
        light: '#2D4C54',
        dark: '#0E1C20',
        contrastText: '#FFFFFF',
      },
      error: {
        main: '#D92D20',      // Discount labels
        light: '#FEE4E2',
        dark: '#B42318',
        contrastText: '#FFFFFF',
      },
      warning: {
        main: '#F59E0B',
        light: '#FEF3C7',
        dark: '#B45309',
      },
      success: {
        main: '#10B981',
        light: '#D1FAE5',
        dark: '#047857',
      },
      background: {
        default: isLight ? '#FFFFFF' : '#0B0F19',
        paper: isLight ? '#FFFFFF' : '#111827',
      },
      text: {
        primary: isLight ? '#172B30' : '#F8FAFC',    // Headings #172B30
        secondary: isLight ? '#374151' : '#94A3B8',  // Body text #374151
      },
      divider: isLight ? '#E5E7EB' : '#1E293B',     // Borders #E5E7EB
    },
    typography: {
      fontFamily: '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      h1: { fontWeight: 900, letterSpacing: '-0.035em', color: isLight ? '#172B30' : '#F8FAFC' },
      h2: { fontWeight: 800, letterSpacing: '-0.03em', color: isLight ? '#172B30' : '#F8FAFC' },
      h3: { fontWeight: 800, letterSpacing: '-0.025em', color: isLight ? '#172B30' : '#F8FAFC' },
      h4: { fontWeight: 700, letterSpacing: '-0.02em', color: isLight ? '#172B30' : '#F8FAFC' },
      h5: { fontWeight: 700, letterSpacing: '-0.015em', color: isLight ? '#172B30' : '#F8FAFC' },
      h6: { fontWeight: 700, letterSpacing: '-0.01em', color: isLight ? '#172B30' : '#F8FAFC' },
      subtitle1: { fontWeight: 600, color: isLight ? '#172B30' : '#F8FAFC' },
      subtitle2: { fontWeight: 600, color: isLight ? '#172B30' : '#CBD5E1' },
      body1: { fontSize: '0.9375rem', lineHeight: 1.6, color: isLight ? '#374151' : '#94A3B8' },
      body2: { fontSize: '0.875rem', lineHeight: 1.5, color: isLight ? '#374151' : '#94A3B8' },
      button: { fontWeight: 700, textTransform: 'none', letterSpacing: '0.01em' },
    },
    shape: {
      borderRadius: 8,
    },
    shadows: [
      'none',
      isLight ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
      isLight ? '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)' : '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
      isLight ? '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.03)' : '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
      isLight ? '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)' : '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    ],
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            padding: '10px 22px',
            fontWeight: 700,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: 'none',
            '&:active': {
              transform: 'scale(0.98)',
            },
          },
          containedPrimary: {
            backgroundColor: '#FF7900',
            color: '#FFFFFF',
            '&:hover': {
              backgroundColor: '#E85D04',
            },
          },
          containedSecondary: {
            backgroundColor: isLight ? '#172B30' : '#1E293B',
            color: '#FFFFFF',
            '&:hover': {
              backgroundColor: isLight ? '#0E1C20' : '#334155',
            },
          },
          outlinedPrimary: {
            borderColor: '#FF7900',
            color: '#FF7900',
            '&:hover': {
              borderColor: '#E85D04',
              backgroundColor: 'rgba(255, 121, 0, 0.08)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            border: `1px solid ${isLight ? '#E5E7EB' : '#1E293B'}`,
            backgroundColor: isLight ? '#FFFFFF' : '#111827',
            boxShadow: isLight ? '0 1px 3px 0 rgba(0, 0, 0, 0.04)' : '0 1px 3px 0 rgba(0, 0, 0, 0.4)',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              boxShadow: isLight ? '0 16px 32px -8px rgba(0, 0, 0, 0.08)' : '0 16px 32px -8px rgba(0, 0, 0, 0.6)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            fontWeight: 700,
            fontSize: '0.75rem',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          rounded: {
            borderRadius: 8,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isLight ? '#FFFFFF' : '#0B0F19',
            color: isLight ? '#172B30' : '#F8FAFC',
            boxShadow: isLight ? '0 1px 3px 0 rgba(0, 0, 0, 0.05)' : '0 1px 3px 0 rgba(0, 0, 0, 0.4)',
          },
        },
      },
    },
  });
};

// Default export for initial render & fallback
export const theme = getTheme('light');
