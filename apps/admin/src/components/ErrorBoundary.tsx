import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Box, Container, Typography, Paper, Button, Stack, Chip,
  Divider, Collapse, IconButton,
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
import { useAdminAuthStore } from '../store/auth.store';

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
    console.error('Unhandled admin console runtime error:', error, errorInfo);
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
      useAdminAuthStore.getState().clearAuth();
    } catch {
      // Fallback
      localStorage.removeItem('ornate-admin-auth');
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
            bgcolor: '#0f172a',
          }}
        >
          <Container maxWidth="md">
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3.5, sm: 5 },
                borderRadius: '12px',
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              }}
            >
              {/* Header Badge */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Chip
                  icon={<ErrorIcon sx={{ fontSize: '16px !important', color: '#b91c1c !important' }} />}
                  label="CONSOLE RUNTIME EXCEPTION"
                  size="small"
                  sx={{
                    bgcolor: '#fef2f2',
                    color: '#b91c1c',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    letterSpacing: 0.5,
                    border: '1px solid #fecaca',
                  }}
                />

                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                  E-Shophy Admin Protection
                </Typography>
              </Box>

              <Typography
                variant="h4"
                sx={{
                  fontWeight: 900,
                  color: '#0f172a',
                  letterSpacing: '-0.025em',
                  mb: 1.5,
                }}
              >
                Something went wrong in the Admin Console
              </Typography>

              <Typography
                variant="body1"
                sx={{
                  color: '#475569',
                  lineHeight: 1.6,
                  mb: 3,
                }}
              >
                An unexpected runtime error caused this view to crash safely. Your database and backend services are safe. You can reload this view, return to the dashboard, or sign out.
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
                    color: '#ffffff',
                    fontWeight: 700,
                    px: 3,
                    py: 1.25,
                    borderRadius: '8px',
                    '&:hover': { bgcolor: '#E85D04' },
                  }}
                >
                  Reload Console
                </Button>

                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<HomeIcon />}
                  onClick={this.handleGoHome}
                  sx={{
                    borderColor: '#cbd5e1',
                    color: '#0f172a',
                    fontWeight: 700,
                    px: 3,
                    py: 1.25,
                    borderRadius: '8px',
                    '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
                  }}
                >
                  Back to Dashboard
                </Button>

                <Button
                  variant="outlined"
                  color="error"
                  size="large"
                  startIcon={<LogoutIcon />}
                  onClick={this.handleLogout}
                  sx={{
                    borderColor: '#fca5a5',
                    color: '#dc2626',
                    fontWeight: 700,
                    px: 3,
                    py: 1.25,
                    borderRadius: '8px',
                    ml: { sm: 'auto !important' },
                    '&:hover': { borderColor: '#ef4444', bgcolor: '#fef2f2' },
                  }}
                >
                  Sign Out / Logout
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
                    color: '#64748b',
                    fontWeight: 600,
                    textTransform: 'none',
                    p: 0,
                    '&:hover': { color: '#0f172a', bgcolor: 'transparent' },
                  }}
                >
                  {showDetails ? 'Hide error details' : 'Show technical error details'}
                </Button>

                <Collapse in={showDetails}>
                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      bgcolor: '#0f172a',
                      color: '#f8fafc',
                      borderRadius: '8px',
                      overflowX: 'auto',
                      fontFamily: 'Consolas, Monaco, monospace',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      border: '1px solid #334155',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#f87171', fontWeight: 700, display: 'block', mb: 1 }}>
                      {error?.toString()}
                    </Typography>
                    {errorInfo?.componentStack && (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#94a3b8' }}>
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
