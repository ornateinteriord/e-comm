import React, { useState, type FormEvent } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  TextField,
  Button,
  MenuItem,
  Alert,
  CircularProgress,
  Stack,
  Breadcrumbs,
  Link,
  useTheme,
  InputAdornment,
  Divider,
} from '@mui/material';
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Send as SendIcon,
  CheckCircleOutline as CheckCircleIcon,
  SupportAgent as SupportAgentIcon,
  AccessTime as AccessTimeIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router';
import api from '../api/client';

const SUBJECT_OPTIONS = [
  'Order & Delivery Inquiry',
  'Payment & Refund Assistance',
  'Vendor / Sponsor Partnership',
  'Product & Warranty Question',
  'Account & Referral Support',
  'General Feedback or Suggestion',
];

export default function ContactPage() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: SUBJECT_OPTIONS[0],
    message: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = form.name.trim();
    const cleanEmail = form.email.trim();
    const cleanMessage = form.message.trim();

    if (!cleanName || !cleanEmail || !cleanMessage) {
      setErrorMessage('Please fill in your name, email, and message.');
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await api.post('/contact', {
        name: cleanName,
        email: cleanEmail,
        phone: form.phone.trim() || undefined,
        subject: form.subject,
        message: cleanMessage,
      });

      setSuccessMessage(
        data.message ||
          'Thank you for reaching out! Your message has been safely received. Our concierge team will respond shortly.',
      );
      setForm({
        name: '',
        email: '',
        phone: '',
        subject: SUBJECT_OPTIONS[0],
        message: '',
      });
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error?.message ||
          'Failed to send your message. Please check your network connection or try again later.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ bgcolor: isLight ? '#f8fafc' : '#090d16', minHeight: '80vh', pb: 10 }}>
      {/* Top Banner */}
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
            <Link
              component={RouterLink}
              to="/"
              sx={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', '&:hover': { color: '#FF7900' } }}
            >
              Home
            </Link>
            <Typography sx={{ color: '#ffffff', fontWeight: 600 }}>Contact Us</Typography>
          </Breadcrumbs>

          <Typography
            variant="h3"
            fontWeight={900}
            letterSpacing="-0.03em"
            sx={{ fontSize: { xs: '2rem', md: '2.75rem' }, mb: 1.5 }}
          >
            Contact Customer Concierge
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: '#94A3B8', maxWidth: 650, fontSize: { xs: '0.95rem', md: '1.05rem' }, lineHeight: 1.6 }}
          >
            Have a question about an order, shipment status, product warranty, or vendor partnership? We are here to assist you every day.
          </Typography>
        </Container>
      </Box>

      {/* Main Container */}
      <Container maxWidth="lg" sx={{ mt: { xs: -3, md: -4 } }}>
        {/* Quick Contact Cards */}
        <Grid container spacing={3} sx={{ mb: 5 }}>
          <Grid item xs={12} sm={4}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                bgcolor: isLight ? '#ffffff' : '#111827',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                height: '100%',
              }}
            >
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '10px',
                  bgcolor: 'rgba(255, 121, 0, 0.1)',
                  color: '#FF7900',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <EmailIcon fontSize="medium" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  Email Support
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'text.primary', mt: 0.25 }}>
                  support@eshopy.biz
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <AccessTimeIcon sx={{ fontSize: 13 }} /> Typical reply within 2-4 hours
                </Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                bgcolor: isLight ? '#ffffff' : '#111827',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                height: '100%',
              }}
            >
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '10px',
                  bgcolor: 'rgba(255, 121, 0, 0.1)',
                  color: '#FF7900',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PhoneIcon fontSize="medium" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  Direct Phone Hotline
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'text.primary', mt: 0.25 }}>
                  +91 1800-889-2700
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <AccessTimeIcon sx={{ fontSize: 13 }} /> Mon - Sat, 9:00 AM - 7:00 PM IST
                </Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                bgcolor: isLight ? '#ffffff' : '#111827',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                height: '100%',
              }}
            >
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '10px',
                  bgcolor: 'rgba(255, 121, 0, 0.1)',
                  color: '#FF7900',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LocationIcon fontSize="medium" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  Corporate Hub
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'text.primary', mt: 0.25 }}>
                  Bengaluru, Karnataka
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  PIN: 560073, India
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Form and FAQ Section */}
        <Grid container spacing={4}>
          {/* Contact Form */}
          <Grid item xs={12} md={7}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 5 },
                borderRadius: '16px',
                border: '1px solid',
                borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                bgcolor: isLight ? '#ffffff' : '#111827',
                boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" fontWeight={800} sx={{ color: 'text.primary' }}>
                  Send Us a Direct Message
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Fill in the details below and our dedicated customer concierge team will get back to you promptly.
                </Typography>
              </Box>

              {successMessage && (
                <Alert
                  severity="success"
                  icon={<CheckCircleIcon fontSize="inherit" />}
                  sx={{ mb: 3, borderRadius: '8px' }}
                >
                  {successMessage}
                </Alert>
              )}

              {errorMessage && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
                  {errorMessage}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <Stack spacing={2.5}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Your Full Name"
                        required
                        fullWidth
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. John Doe"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Email Address"
                        type="email"
                        required
                        fullWidth
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="name@example.com"
                      />
                    </Grid>
                  </Grid>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Phone Number"
                        type="tel"
                        fullWidth
                        value={form.phone}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setForm({ ...form, phone: digits });
                        }}
                        placeholder="9876543210"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                                +91
                              </Typography>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        select
                        label="Inquiry Subject"
                        fullWidth
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      >
                        {SUBJECT_OPTIONS.map((opt) => (
                          <MenuItem key={opt} value={opt}>
                            {opt}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  </Grid>

                  <TextField
                    label="Your Message / Query"
                    required
                    fullWidth
                    multiline
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Please describe how we can assist you with your order, product specifications, or service..."
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                    sx={{
                      py: 1.5,
                      borderRadius: '8px',
                      fontWeight: 800,
                      bgcolor: '#FF7900',
                      '&:hover': { bgcolor: '#e06b00' },
                      fontSize: '1rem',
                      textTransform: 'none',
                    }}
                  >
                    {isLoading ? 'Submitting Message...' : 'Submit Inquiry'}
                  </Button>
                </Stack>
              </form>
            </Paper>
          </Grid>

          {/* Right Side: FAQ and Assurance Card */}
          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  borderRadius: '16px',
                  border: '1px solid',
                  borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                  bgcolor: isLight ? '#ffffff' : '#111827',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <HelpIcon sx={{ color: '#FF7900' }} />
                  <Typography variant="h6" fontWeight={800} sx={{ color: 'text.primary' }}>
                    Frequently Asked
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2.5 }} />

                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                      Where can I track my active dispatch?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      You can monitor real-time fulfillment updates directly on your{' '}
                      <Link component={RouterLink} to="/orders" sx={{ color: '#FF7900', fontWeight: 700 }}>
                        Orders Page
                      </Link>{' '}
                      with live carrier tracking IDs.
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                      How does vendor referral work?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Each customer account is mapped to their verified sponsor code. Successful registrations automatically increment levels and token allocations.
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                      Are invoices GST compliant?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Yes, every completed order automatically generates an official GST tax invoice accessible from your account portal.
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '16px',
                  bgcolor: isLight ? '#f1f5f9' : '#1e293b',
                  border: '1px solid',
                  borderColor: isLight ? '#cbd5e1' : '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <SupportAgentIcon sx={{ fontSize: 36, color: '#FF7900' }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                    Need Urgent Order Assistance?
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Call our toll-free line directly for priority escalations during working hours.
                  </Typography>
                </Box>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

