import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import {
  CheckCircleOutline,
  ErrorOutline,
  AccessTime,
  CancelOutlined,
  Receipt,
  ArrowForward,
  Refresh,
  ShoppingBag,
} from '@mui/icons-material';
import api from '../api/client';
import { useCartStore } from '../store/cart.store';

type PaymentState = 'verifying' | 'success' | 'failed' | 'pending_timeout' | 'user_dropped';

const MAX_ATTEMPTS = 6;

export default function PaymentReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clearCart = useCartStore((s) => s.clearCart);

  const orderId = searchParams.get('order_id') || '';
  const cfOrderId = searchParams.get('cf_order_id') || searchParams.get('order_token') || '';

  const [status, setStatus] = useState<PaymentState>('verifying');
  const [paymentDetails, setPaymentDetails] = useState<{
    cfPaymentId?: string;
    orderId?: string;
    message?: string;
  }>({});
  const [attempt, setAttempt] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasClearedCart = useRef(false);

  const verifyPayment = useCallback(async (currentAttempt = 1) => {
    if (!orderId && !cfOrderId) {
      setStatus('failed');
      setErrorMessage('Missing order information in return URL.');
      return;
    }

    try {
      const res = await api.post('/payments/cashfree/verify', {
        orderId: orderId || undefined,
        cf_order_id: cfOrderId || undefined,
      });

      const data = res.data?.data;
      const paymentStatus = (data?.status || '').toUpperCase();

      if (paymentStatus === 'PAID' || paymentStatus === 'SUCCESS') {
        setStatus('success');
        setPaymentDetails({
          cfPaymentId: data?.cfPaymentId,
          orderId: data?.orderId || orderId,
        });

        if (!hasClearedCart.current) {
          clearCart();
          hasClearedCart.current = true;
          // Trigger non-blocking invoice generation
          api.post('/invoices/generate', { orderId: data?.orderId || orderId }).catch(() => {});
        }
      } else if (paymentStatus === 'USER_DROPPED') {
        setStatus('user_dropped');
        setErrorMessage(data?.message || 'You cancelled the payment or closed the checkout window.');
      } else if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED') {
        setStatus('failed');
        setErrorMessage(data?.message || 'Payment was not successful. Please try again.');
      } else if (paymentStatus === 'PENDING') {
        if (currentAttempt >= MAX_ATTEMPTS) {
          setStatus('pending_timeout');
        } else {
          setAttempt(currentAttempt + 1);
        }
      } else {
        setStatus('failed');
        setErrorMessage(data?.message || 'Payment was not successful. Please try again.');
      }
    } catch (err: any) {
      const apiErr = err.response?.data?.error?.message;
      if (err.response?.status === 402) {
        setStatus('failed');
        setErrorMessage(apiErr || 'Payment failed or expired.');
      } else {
        if (currentAttempt >= MAX_ATTEMPTS) {
          setStatus('pending_timeout');
        } else {
          setAttempt(currentAttempt + 1);
        }
      }
    }
  }, [orderId, cfOrderId, clearCart]);

  // Initial call on mount
  useEffect(() => {
    verifyPayment(1);
  }, [verifyPayment]);

  // Polling loop when status is 'verifying' and attempt is between 2 and MAX_ATTEMPTS
  useEffect(() => {
    if (status !== 'verifying' || attempt <= 1 || attempt > MAX_ATTEMPTS) return;

    const timer = setTimeout(() => {
      verifyPayment(attempt);
    }, 3500);

    return () => clearTimeout(timer);
  }, [attempt, status, verifyPayment]);

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 5 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
        }}
      >
        {/* State: Verifying */}
        {status === 'verifying' && (
          <Box sx={{ py: 4 }}>
            <CircularProgress size={56} sx={{ color: '#FF7900', mb: 3 }} />
            <Typography variant="h5" fontWeight={800} sx={{ mb: 1.5 }}>
              Verifying Payment
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              Please wait while we confirm your payment securely with Cashfree and your bank...
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Do not refresh or close this tab (Attempt {Math.min(attempt, MAX_ATTEMPTS)}/{MAX_ATTEMPTS})
            </Typography>
          </Box>
        )}

        {/* State: Success */}
        {status === 'success' && (
          <Box sx={{ py: 2 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'success.light',
                color: 'success.dark',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2.5,
              }}
            >
              <CheckCircleOutline sx={{ fontSize: 44 }} />
            </Box>
            <Typography variant="h4" fontWeight={900} letterSpacing="-0.02em" sx={{ mb: 1 }}>
              Payment Successful!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Thank you! Your order has been placed and payment confirmed.
            </Typography>

            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                mb: 4,
                bgcolor: 'grey.50',
                borderRadius: 2,
                textAlign: 'left',
              }}
            >
              <Stack spacing={1.5}>
                {orderId && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Order ID:</Typography>
                    <Typography variant="body2" fontWeight={700}>{orderId}</Typography>
                  </Box>
                )}
                {paymentDetails.cfPaymentId && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Cashfree Ref:</Typography>
                    <Typography variant="body2" fontWeight={600}>{paymentDetails.cfPaymentId}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Payment Status:</Typography>
                  <Chip label="PAID" color="success" size="small" sx={{ fontWeight: 700 }} />
                </Box>
              </Stack>
            </Paper>

            <Stack spacing={2}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                endIcon={<ArrowForward />}
                onClick={() => navigate(`/orders/${orderId}`)}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 700,
                  bgcolor: '#FF7900',
                  color: '#fff',
                  '&:hover': { bgcolor: '#E85D04' },
                }}
              >
                View Order Details
              </Button>
              <Button
                variant="outlined"
                fullWidth
                component={RouterLink}
                to="/"
                startIcon={<ShoppingBag />}
                sx={{ py: 1.2, borderRadius: 2, fontWeight: 600 }}
              >
                Continue Shopping
              </Button>
            </Stack>
          </Box>
        )}

        {/* State: User Dropped / Cancelled */}
        {status === 'user_dropped' && (
          <Box sx={{ py: 2 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'warning.light',
                color: 'warning.dark',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2.5,
              }}
            >
              <CancelOutlined sx={{ fontSize: 44 }} />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ mb: 1.5 }}>
              Payment Cancelled
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {errorMessage || 'You cancelled or closed the checkout session before completing the payment.'}
            </Typography>

            <Alert severity="info" sx={{ mb: 3, textAlign: 'left', borderRadius: 2 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                No money was deducted
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Your items are still safely saved in your cart. You can complete your order anytime by trying checkout again.
              </Typography>
            </Alert>

            {orderId && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 3,
                  bgcolor: 'grey.50',
                  borderRadius: 2,
                  textAlign: 'left',
                }}
              >
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Order ID:</Typography>
                    <Typography variant="body2" fontWeight={700}>{orderId}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Payment Status:</Typography>
                    <Chip label="CANCELLED / DROPPED" color="default" size="small" sx={{ fontWeight: 700 }} />
                  </Box>
                </Stack>
              </Paper>
            )}

            <Stack spacing={2}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                component={RouterLink}
                to="/checkout"
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 700,
                  bgcolor: '#FF7900',
                  color: '#fff',
                  '&:hover': { bgcolor: '#E85D04' },
                }}
              >
                Try Payment Again
              </Button>
              <Button
                variant="outlined"
                fullWidth
                component={RouterLink}
                to="/cart"
                startIcon={<ShoppingBag />}
                sx={{ py: 1.2, borderRadius: 2, fontWeight: 600 }}
              >
                Return to Cart
              </Button>
            </Stack>
          </Box>
        )}

        {/* State: Pending / Timeout */}
        {status === 'pending_timeout' && (
          <Box sx={{ py: 2 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'warning.light',
                color: 'warning.dark',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2.5,
              }}
            >
              <AccessTime sx={{ fontSize: 44 }} />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ mb: 1.5 }}>
              Payment Processing
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Your bank or payment app is taking a few moments to confirm.
            </Typography>

            <Alert severity="info" sx={{ mb: 3, textAlign: 'left', borderRadius: 2 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                Did money get deducted from your account?
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Don&apos;t worry! Our automated webhook will mark your order as confirmed as soon as
                Cashfree transmits the settlement signal. If the transaction was not completed, your
                bank will reverse the amount automatically within 5-7 business days.
              </Typography>
            </Alert>

            {orderId && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 3,
                  bgcolor: 'grey.50',
                  borderRadius: 2,
                  textAlign: 'left',
                }}
              >
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Order ID:</Typography>
                    <Typography variant="body2" fontWeight={700}>{orderId}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Payment Status:</Typography>
                    <Chip label="PENDING VERIFICATION" color="warning" size="small" sx={{ fontWeight: 700 }} />
                  </Box>
                </Stack>
              </Paper>
            )}

            <Stack spacing={2}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                startIcon={<Refresh />}
                onClick={() => {
                  setAttempt(1);
                  setStatus('verifying');
                  verifyPayment(1);
                }}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 700,
                  bgcolor: '#FF7900',
                  color: '#fff',
                  '&:hover': { bgcolor: '#E85D04' },
                }}
              >
                Re-check Payment Status
              </Button>
              {orderId && (
                <Button
                  variant="outlined"
                  fullWidth
                  component={RouterLink}
                  to={`/orders/${orderId}`}
                  endIcon={<ArrowForward />}
                  sx={{ py: 1.2, borderRadius: 2, fontWeight: 600 }}
                >
                  Go to My Orders
                </Button>
              )}
            </Stack>
          </Box>
        )}

        {/* State: Failed */}
        {status === 'failed' && (
          <Box sx={{ py: 2 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'error.light',
                color: 'error.dark',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2.5,
              }}
            >
              <ErrorOutline sx={{ fontSize: 44 }} />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ mb: 1.5 }}>
              Payment Incomplete or Failed
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {errorMessage || 'The payment was cancelled, failed, or timed out.'}
            </Typography>

            <Alert severity="warning" sx={{ mb: 3, textAlign: 'left', borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">
                If money was deducted from your account, it will be automatically refunded by your bank
                within 5–7 business days, or reconciled automatically by our system if settled.
              </Typography>
            </Alert>

            {orderId && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 3,
                  bgcolor: 'grey.50',
                  borderRadius: 2,
                  textAlign: 'left',
                }}
              >
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Order ID:</Typography>
                    <Typography variant="body2" fontWeight={700}>{orderId}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Payment Status:</Typography>
                    <Chip label="FAILED" color="error" size="small" sx={{ fontWeight: 700 }} />
                  </Box>
                </Stack>
              </Paper>
            )}

            <Divider sx={{ my: 3 }} />

            <Stack spacing={2}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                component={RouterLink}
                to="/checkout"
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 700,
                  bgcolor: '#FF7900',
                  color: '#fff',
                  '&:hover': { bgcolor: '#E85D04' },
                }}
              >
                Try Payment Again
              </Button>
              <Button
                variant="outlined"
                fullWidth
                component={RouterLink}
                to="/cart"
                startIcon={<ShoppingBag />}
                sx={{ py: 1.2, borderRadius: 2, fontWeight: 600 }}
              >
                Return to Cart
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
