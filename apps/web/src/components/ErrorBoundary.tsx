import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Box, Container, Typography, Paper, Button, Stack, Chip,
  Divider, Collapse,
} from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  Logout as LogoutIcon,
  Code as CodeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/auth.store';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled storefront application error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  private handleLogout = () => {
    try {
      useAuthStore.getState().clearAuth();
    } catch {
      localStorage.removeItem('ornate-auth');
    }
    window.location.href = '/login';
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;

      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 2, sm: 4 },
            bgcolor: '#172B30',
          }}
        >
          <Container maxWidth="md">
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3.5, sm: 5 },
                borderRadius: '16px',
                bgcolor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
              }}
            >
              {/* Header Badge */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Chip
                  icon={<ErrorIcon sx={{ fontSize: '16px !important', color: '#D92D20 !important' }} />}
                  label="APPLICATION RUNTIME ERROR"
                  size="small"
                  sx={{
                    bgcolor: '#FEF3F2',
                    color: '#D92D20',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    letterSpacing: 0.5,
                    border: '1px solid #FECDCA',
                  }}
                />

                <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 600 }}>
                  E-Shophy Protection
                </Typography>
              </Box>

              <Typography
                variant="h4"
                sx={{
                  fontWeight: 900,
                  color: '#172B30',
                  letterSpacing: '-0.025em',
                  mb: 1.5,
                }}
              >
                Something went unexpectedly wrong
              </Typography>

              <Typography
                variant="body1"
                sx={{
                  color: '#4B5563',
                  lineHeight: 1.6,
                  mb: 3.5,
                }}
              >
                We encountered an unexpected problem rendering this page. You can reload the page, return to the storefront home, or sign out to reset your session.
              </Typography>

              {/* Action Buttons */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3.5 }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReset}
                  sx={{
                    bgcolor: '#FF7900',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    px: 3,
                    py: 1.25,
                    borderRadius: '8px',
                    '&:hover': { bgcolor: '#E85D04' },
                  }}
                >
                  Reload Page
                </Button>

                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<HomeIcon />}
                  onClick={this.handleGoHome}
                  sx={{
                    borderColor: '#E5E7EB',
                    color: '#172B30',
                    fontWeight: 700,
                    px: 3,
                    py: 1.25,
                    borderRadius: '8px',
                    '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' },
                  }}
                >
                  Back to Store Home
                </Button>

                <Button
                  variant="outlined"
                  color="error"
                  size="large"
                  startIcon={<LogoutIcon />}
                  onClick={this.handleLogout}
                  sx={{
                    borderColor: '#FCA5A5',
                    color: '#DC2626',
                    fontWeight: 700,
                    px: 3,
                    py: 1.25,
                    borderRadius: '8px',
                    ml: { sm: 'auto !important' },
                    '&:hover': { borderColor: '#EF4444', bgcolor: '#FEF2F2' },
                  }}
                >
                  Sign Out / Reset Session
                </Button>
              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* Technical Details Toggle */}
              <Box>
                <Button
                  size="small"
                  startIcon={<CodeIcon sx={{ fontSize: 16 }} />}
                  endIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  onClick={this.toggleDetails}
                  sx={{
                    color: '#6B7280',
                    fontWeight: 600,
                    textTransform: 'none',
                    p: 0,
                    '&:hover': { color: '#172B30', bgcolor: 'transparent' },
                  }}
                >
                  {showDetails ? 'Hide technical error details' : 'Show technical error details'}
                </Button>

                <Collapse in={showDetails}>
                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      bgcolor: '#0F172A',
                      color: '#F8FAFC',
                      borderRadius: '8px',
                      overflowX: 'auto',
                      fontFamily: 'Consolas, Monaco, monospace',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      border: '1px solid #334155',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#F87171', fontWeight: 700, display: 'block', mb: 1 }}>
                      {error?.toString()}
                    </Typography>
                    {errorInfo?.componentStack && (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#94A3B8' }}>
                        {errorInfo.componentStack}
                      </pre>
                    )}
                  </Box>
                </Collapse>
              </Box>
            </Paper>
          </Container>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
