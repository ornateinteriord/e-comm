import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Stack,
  Chip,
  Alert,
  Divider,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Breadcrumbs,
  Link,
  Card,
  CardContent,
  useTheme,
} from '@mui/material';
import {
  Shield as ShieldIcon,
  Login as LoginIcon,
  ManageAccounts as AccountIcon,
  AssignmentTurnedIn as ChecklistIcon,
  DeleteForever as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  PendingActions as PendingIcon,
  Info as InfoIcon,
  Lock as LockIcon,
  Security as SecurityIcon,
  HelpOutline as HelpIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';

export default function DataDeletionInstructionsPage() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { isAuthenticated, user } = useAuthStore();

  // Form State for Logged-in Users
  const [reasonType, setReasonType] = useState('privacy');
  const [customReason, setCustomReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Check active deletion request if logged in
  const { data: deletionRequest, refetch: refetchDeletionRequest } = useQuery({
    queryKey: ['my-deletion-request-instructions'],
    queryFn: async () => {
      if (!isAuthenticated) return null;
      try {
        const res = await api.get('/privacy/deletion-request');
        return res.data?.data;
      } catch {
        return null;
      }
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 30,
  });

  // Mutation to submit deletion request
  const submitMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      const reasonMap: Record<string, string> = {
        privacy: 'Privacy concerns & personal data retention preference',
        not_using: 'No longer using E-Shopy account',
        duplicate: 'Duplicate or unwanted secondary account',
        other: customReason.trim() || 'Customer requested data erasure under DPDP Act',
      };
      const finalReason = reasonMap[reasonType] || customReason.trim();
      const res = await api.post('/privacy/deletion-request', {
        reason: finalReason,
        notes: customReason.trim() ? customReason.trim() : undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      refetchDeletionRequest();
      queryClient.invalidateQueries({ queryKey: ['my-deletion-request'] });
      setConfirmed(false);
      setCustomReason('');
      setFormSuccess('Your personal data deletion request has been submitted and is under compliance review.');
      setTimeout(() => setFormSuccess(null), 7000);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || 'Failed to submit data deletion request.');
    },
  });

  // Mutation to cancel deletion request
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete('/privacy/deletion-request');
      return res.data;
    },
    onSuccess: () => {
      refetchDeletionRequest();
      queryClient.invalidateQueries({ queryKey: ['my-deletion-request'] });
      setFormSuccess('Your data deletion request has been cancelled.');
      setTimeout(() => setFormSuccess(null), 5000);
    },
  });

  return (
    <Box sx={{ bgcolor: isLight ? '#f8fafc' : '#090d16', minHeight: '85vh', pb: 10 }}>
      {/* Top Banner Header */}
      <Box
        sx={{
          bgcolor: isLight ? '#172B30' : '#0B0F19',
          color: '#ffffff',
          py: { xs: 5, md: 7 },
          borderBottom: '1px solid',
          borderColor: isLight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)',
        }}
      >
        <Container maxWidth="lg">
          <Breadcrumbs
            aria-label="breadcrumb"
            sx={{
              mb: 2,
              '& .MuiBreadcrumbs-separator': { color: 'rgba(255, 255, 255, 0.5)' },
            }}
          >
            <Link component={RouterLink} to="/" sx={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', '&:hover': { color: '#FF7900' } }}>
              Home
            </Link>
            <Typography sx={{ color: '#ffffff', fontWeight: 600 }}>User Data Deletion Instructions</Typography>
          </Breadcrumbs>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
            <Typography variant="h3" fontWeight={900} letterSpacing="-0.03em" sx={{ fontSize: { xs: '1.85rem', md: '2.5rem' } }}>
              User Data Deletion Instructions
            </Typography>
            <Chip
              label="DPDP Act 2023 · Section 12"
              size="small"
              sx={{
                bgcolor: 'rgba(255, 121, 0, 0.2)',
                color: '#FF9E40',
                border: '1px solid rgba(255, 121, 0, 0.45)',
                fontWeight: 800,
                fontSize: '0.72rem',
              }}
            />
          </Box>

          <Typography variant="body1" sx={{ color: '#94A3B8', maxWidth: 760, fontSize: { xs: '0.95rem', md: '1.05rem' }, lineHeight: 1.6 }}>
            Step-by-step guidance on how to request the permanent erasure of your personal data and account records from E-Shopy in accordance with the Digital Personal Data Protection Act, 2023.
          </Typography>
        </Container>
      </Box>

      {/* Main Content Container */}
      <Container maxWidth="lg" sx={{ mt: { xs: 4, md: 5 } }}>
        {/* Auth Status Notification Bar */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 4,
            borderRadius: '14px',
            border: '1.5px solid',
            borderColor: isAuthenticated ? '#bbf7d0' : '#fed7aa',
            bgcolor: isAuthenticated ? '#f0fdf4' : '#fffbeb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {isAuthenticated ? (
              <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 26 }} />
            ) : (
              <InfoIcon sx={{ color: '#ea580c', fontSize: 26 }} />
            )}
            <Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: isAuthenticated ? '#15803d' : '#9a3412' }}>
                {isAuthenticated
                  ? `Signed in as ${user?.name || user?.email || 'Customer'}`
                  : 'Public Guidance Notice (Guest Mode)'}
              </Typography>
              <Typography variant="caption" sx={{ color: isAuthenticated ? '#166534' : '#b45309', display: 'block' }}>
                {isAuthenticated
                  ? 'Your account is verified. You can review the instructions or submit your data erasure request directly below.'
                  : 'These instructions are publicly accessible. To submit an erasure request for your account, you must log in first.'}
              </Typography>
            </Box>
          </Box>

          {!isAuthenticated && (
            <Button
              variant="contained"
              size="small"
              startIcon={<LoginIcon />}
              onClick={() => navigate('/login?redirect=/data-deletion-requests')}
              sx={{
                bgcolor: '#FF7900',
                color: '#ffffff',
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: '8px',
                px: 2.5,
                '&:hover': { bgcolor: '#e06b00' },
              }}
            >
              Sign In to Continue
            </Button>
          )}
        </Paper>

        <Grid container spacing={4}>
          {/* LEFT COLUMN: Step-by-Step Instructions */}
          <Grid item xs={12} md={7}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: '16px',
                border: '1px solid',
                borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                bgcolor: isLight ? '#ffffff' : '#111827',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
              }}
            >
              <Typography variant="h5" fontWeight={800} sx={{ color: 'text.primary', mb: 1 }}>
                How to Request Data Deletion
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5, lineHeight: 1.6 }}>
                Follow these simple steps to exercise your statutory Right to Erasure under Section 12 of the DPDP Act, 2023:
              </Typography>

              <Stack spacing={3}>
                {/* Step 1 */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      bgcolor: isAuthenticated ? 'rgba(22, 163, 74, 0.12)' : 'rgba(255, 121, 0, 0.12)',
                      color: isAuthenticated ? '#16a34a' : '#FF7900',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '1rem',
                      flexShrink: 0,
                    }}
                  >
                    1
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800} color="text.primary">
                      Step 1: Sign in to your E-Shopy account
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                      To protect your privacy and ensure that only genuine account owners can request erasure, you must be logged into the account you wish to delete.
                    </Typography>
                    {isAuthenticated ? (
                      <Chip
                        icon={<CheckCircleIcon sx={{ fontSize: '14px !important', color: '#16a34a !important' }} />}
                        label="Completed — You are logged in"
                        size="small"
                        sx={{ mt: 1, bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 700, fontSize: '0.72rem' }}
                      />
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<LoginIcon />}
                        onClick={() => navigate('/login?redirect=/data-deletion-requests')}
                        sx={{ mt: 1.25, textTransform: 'none', fontWeight: 700, borderRadius: '8px', borderColor: '#FF7900', color: '#FF7900' }}
                      >
                        Sign in now
                      </Button>
                    )}
                  </Box>
                </Box>

                <Divider />

                {/* Step 2 */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      bgcolor: 'rgba(255, 121, 0, 0.12)',
                      color: '#FF7900',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '1rem',
                      flexShrink: 0,
                    }}
                  >
                    2
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800} color="text.primary">
                      Step 2: Access your Account & Privacy Settings
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                      Navigate to your <strong>Account Profile</strong> page. Scroll down to the dedicated <strong>"Data Privacy & Account Erasure"</strong> section.
                    </Typography>
                    {isAuthenticated && (
                      <Button
                        component={RouterLink}
                        to="/account"
                        size="small"
                        variant="outlined"
                        startIcon={<AccountIcon />}
                        sx={{ mt: 1.25, textTransform: 'none', fontWeight: 700, borderRadius: '8px', borderColor: '#cbd5e1', color: '#334155' }}
                      >
                        Go to My Account Page
                      </Button>
                    )}
                  </Box>
                </Box>

                <Divider />

                {/* Step 3 */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      bgcolor: 'rgba(255, 121, 0, 0.12)',
                      color: '#FF7900',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '1rem',
                      flexShrink: 0,
                    }}
                  >
                    3
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800} color="text.primary">
                      Step 3: Submit Deletion Request with Reason
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                      Click on <strong>"Request Data Erasure"</strong>. Choose your reason from the dropdown (such as <em>Privacy concerns</em>, <em>No longer using E-Shopy</em>, or <em>Duplicate account</em>), check the statutory confirmation acknowledgment, and click submit.
                    </Typography>
                  </Box>
                </Box>

                <Divider />

                {/* Step 4 */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      bgcolor: 'rgba(22, 163, 74, 0.12)',
                      color: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '1rem',
                      flexShrink: 0,
                    }}
                  >
                    4
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800} color="text.primary">
                      Step 4: Compliance Officer Review & Permanent Erasure
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                      Our Data Protection Officer verifies that there are no active transit shipments or unresolved disputes. Upon approval, all your personal identifying data is permanently erased. You will receive an on-screen status update in real-time.
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </Paper>

            {/* Scope of Data Erasure Details */}
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 4 },
                mt: 3,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                bgcolor: isLight ? '#ffffff' : '#111827',
              }}
            >
              <Typography variant="h6" fontWeight={800} sx={{ color: 'text.primary', mb: 1.5 }}>
                What Data is Erased vs Retained?
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ bgcolor: '#fef2f2', p: 2, borderRadius: '10px', border: '1px solid #fecaca', height: '100%' }}>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#991b1b', mb: 1 }}>
                      ✕ Permanently Deleted
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#7f1d1d', fontSize: '0.825rem', lineHeight: 1.6 }}>
                      <li>Full name and account profile details</li>
                      <li>Registered email and phone number</li>
                      <li>All saved delivery addresses</li>
                      <li>Wishlist and shopping cart items</li>
                      <li>Login credentials and authentication tokens</li>
                    </ul>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ bgcolor: '#f0fdf4', p: 2, borderRadius: '10px', border: '1px solid #bbf7d0', height: '100%' }}>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#166534', mb: 1 }}>
                      ✓ Retained in Anonymized Form
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#14532d', fontSize: '0.825rem', lineHeight: 1.6 }}>
                      <li>Past order totals & tax invoices (anonymized)</li>
                      <li>Retained strictly to comply with mandatory GST and Indian tax accounting laws (7-year statutory requirement)</li>
                    </ul>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* RIGHT COLUMN: Interactive Action Card (Gated for Logged-In Users) */}
          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              {/* Direct Request Submission Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 3.5,
                  borderRadius: '16px',
                  border: '1.5px solid',
                  borderColor: isAuthenticated ? '#FF7900' : isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                  bgcolor: isLight ? '#ffffff' : '#111827',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <ShieldIcon sx={{ color: '#FF7900' }} />
                  <Typography variant="h6" fontWeight={800} sx={{ color: 'text.primary' }}>
                    Submit Deletion Request
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2.5 }} />

                {/* LOGGED IN USER INTERFACE */}
                {isAuthenticated ? (
                  <Box>
                    {formSuccess && (
                      <Alert severity="success" sx={{ mb: 2.5, borderRadius: '8px' }}>
                        {formSuccess}
                      </Alert>
                    )}

                    {formError && (
                      <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }}>
                        {formError}
                      </Alert>
                    )}

                    {/* Pending Request View */}
                    {deletionRequest?.status === 'pending' ? (
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: '12px',
                          bgcolor: '#fffbeb',
                          border: '1.5px solid #fde68a',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                          <PendingIcon sx={{ color: '#d97706', fontSize: 22 }} />
                          <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#92400e' }}>
                            Request Under Review
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: '#b45309', fontSize: '0.85rem', lineHeight: 1.5, mb: 2 }}>
                          Your personal data deletion request submitted on{' '}
                          <strong>
                            {new Date(deletionRequest.requestedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </strong>{' '}
                          is currently under review by our Data Protection Compliance team.
                        </Typography>

                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate()}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            borderRadius: '8px',
                            borderColor: '#fcd34d',
                            color: '#92400e',
                            bgcolor: '#ffffff',
                            '&:hover': { bgcolor: '#fef3c7', borderColor: '#f59e0b' },
                          }}
                        >
                          {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Deletion Request'}
                        </Button>
                      </Box>
                    ) : deletionRequest?.status === 'completed' ? (
                      <Box sx={{ p: 2, borderRadius: '10px', bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#166534' }}>
                          Personal Data Erased
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#15803d', fontSize: '0.85rem', mt: 0.5 }}>
                          Your personal identifying data has been successfully erased.
                        </Typography>
                      </Box>
                    ) : (
                      <Box>
                        {deletionRequest?.status === 'rejected' && (
                          <Alert severity="warning" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.825rem' }}>
                            Previous request was rejected: "{deletionRequest.adminNotes}". You may submit a new request below.
                          </Alert>
                        )}

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.875rem' }}>
                          Select your primary reason for deleting personal data:
                        </Typography>

                        <Stack spacing={2}>
                          <TextField
                            select
                            label="Reason for Deletion"
                            fullWidth
                            size="small"
                            value={reasonType}
                            onChange={(e) => setReasonType(e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                          >
                            <MenuItem value="privacy">Privacy concerns & data retention preference</MenuItem>
                            <MenuItem value="not_using">No longer using E-Shopy</MenuItem>
                            <MenuItem value="duplicate">Duplicate or unwanted secondary account</MenuItem>
                            <MenuItem value="other">Other custom reason</MenuItem>
                          </TextField>

                          {reasonType === 'other' && (
                            <TextField
                              label="Please explain reason"
                              required
                              fullWidth
                              size="small"
                              multiline
                              rows={2}
                              value={customReason}
                              onChange={(e) => setCustomReason(e.target.value)}
                              placeholder="Describe reason for data deletion…"
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                            />
                          )}

                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={confirmed}
                                onChange={(e) => setConfirmed(e.target.checked)}
                                color="error"
                              />
                            }
                            label={
                              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4, display: 'block' }}>
                                I confirm that this action will permanently delete my profile and deactivate my account once approved.
                              </Typography>
                            }
                          />

                          <Button
                            fullWidth
                            variant="contained"
                            color="error"
                            disabled={
                              submitMutation.isPending ||
                              !confirmed ||
                              (reasonType === 'other' && !customReason.trim())
                            }
                            onClick={() => submitMutation.mutate()}
                            startIcon={submitMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                            sx={{
                              py: 1.25,
                              borderRadius: '8px',
                              fontWeight: 700,
                              textTransform: 'none',
                              bgcolor: '#dc2626',
                              '&:hover': { bgcolor: '#b91c1c' },
                            }}
                          >
                            {submitMutation.isPending ? 'Submitting…' : 'Submit Deletion Request'}
                          </Button>
                        </Stack>
                      </Box>
                    )}
                  </Box>
                ) : (
                  /* LOGGED OUT GUEST NOTICE */
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '16px',
                        bgcolor: 'rgba(255, 121, 0, 0.1)',
                        color: '#FF7900',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <LockIcon sx={{ fontSize: 28 }} />
                    </Box>

                    <Typography variant="subtitle1" fontWeight={800} color="text.primary" sx={{ mb: 1 }}>
                      Sign In Required to Send Request
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6, fontSize: '0.875rem' }}>
                      In compliance with data protection security protocols, personal data erasure requests can only be initiated by authenticated account owners.
                    </Typography>

                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={<LoginIcon />}
                      onClick={() => navigate('/login?redirect=/data-deletion-requests')}
                      sx={{
                        py: 1.25,
                        borderRadius: '8px',
                        fontWeight: 700,
                        textTransform: 'none',
                        bgcolor: '#FF7900',
                        '&:hover': { bgcolor: '#e06b00' },
                      }}
                    >
                      Sign In to Send Request
                    </Button>
                  </Box>
                )}
              </Paper>

              {/* Data Protection Help Desk */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '16px',
                  border: '1px solid',
                  borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                  bgcolor: isLight ? '#ffffff' : '#111827',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                  <SecurityIcon sx={{ color: '#FF7900' }} />
                  <Typography variant="subtitle1" fontWeight={800} color="text.primary">
                    Data Protection Concierge
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.6, mb: 1.5 }}>
                  Have questions regarding your personal information, privacy preferences, or need assistance with your data deletion?
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                  <strong>Email:</strong>{' '}
                  <Link href="mailto:eshopy650@gmail.com" sx={{ color: '#FF7900', textDecoration: 'none', fontWeight: 700 }}>
                    eshopy650@gmail.com
                  </Link>
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem', mt: 0.5 }}>
                  <strong>Helpline:</strong>{' '}
                  <Link href="tel:+917676518566" sx={{ color: '#FF7900', textDecoration: 'none', fontWeight: 700 }}>
                    +91 7676518566
                  </Link>
                </Typography>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
