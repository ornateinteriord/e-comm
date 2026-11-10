import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Stack,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  useMediaQuery,
  Card,
  CardContent,
  Pagination,
  Select,
  MenuItem,
} from '@mui/material';
import {
  AccountBalanceWallet,
  Add as AddIcon,
  ArrowUpward,
  ArrowDownward,
  History,
  Refresh,
  MonetizationOn,
  CheckCircle,
  ErrorOutline,
  Close as CloseIcon,
  ShoppingCart,
  TrendingUp,
  ReceiptLong,
  Payment,
  CreditCard,
  AccountBalance,
} from '@mui/icons-material';
import { load } from '@cashfreepayments/cashfree-js';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';

export default function WalletPage() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();

  // Dialog State for Add Money
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [amountInput, setAmountInput] = useState('500');
  const [addMoneyError, setAddMoneyError] = useState<string | null>(null);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);

  // Verification state for return URL
  const [isVerifyingTopup, setIsVerifyingTopup] = useState(false);
  const [topupFeedback, setTopupFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Active filter tab
  const [activeTab, setActiveTab] = useState<'all' | 'topup' | 'order_payment' | 'commission'>('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // 1. Fetch Wallet Balance & Stats
  const {
    data: walletInfo,
    isLoading: isLoadingWallet,
    refetch: refetchWallet,
  } = useQuery({
    queryKey: ['wallet-info'],
    queryFn: async () => {
      const { data } = await api.get('/wallet');
      return data.data;
    },
    enabled: isAuthenticated,
  });

  // 2. Fetch Wallet Transactions
  const {
    data: txnsData,
    isLoading: isLoadingTxns,
    refetch: refetchTxns,
  } = useQuery({
    queryKey: ['wallet-transactions', activeTab, page, rowsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(rowsPerPage),
        ...(activeTab !== 'all' ? { category: activeTab } : {}),
      });
      const { data } = await api.get(`/wallet/transactions?${params.toString()}`);
      return data.data;
    },
    enabled: isAuthenticated,
  });

  // Check for return URL callback from Cashfree
  useEffect(() => {
    const cfOrderId = searchParams.get('cf_order_id');
    const topupStatus = searchParams.get('topup_status');

    if (cfOrderId && topupStatus) {
      setIsVerifyingTopup(true);
      api
        .post('/wallet/topup/verify', { cf_order_id: cfOrderId })
        .then((res) => {
          setTopupFeedback({
            type: 'success',
            message: res.data?.message || 'Wallet top-up verified and credited successfully!',
          });
          queryClient.invalidateQueries({ queryKey: ['wallet-info'] });
          queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
          queryClient.invalidateQueries({ queryKey: ['my-wallet-balance'] });
        })
        .catch((err) => {
          setTopupFeedback({
            type: 'error',
            message:
              err.response?.data?.error?.message ||
              err.message ||
              'Payment verification failed or was cancelled.',
          });
        })
        .finally(() => {
          setIsVerifyingTopup(false);
          // Clean query params
          setSearchParams({}, { replace: true });
        });
    }
  }, [searchParams, setSearchParams, queryClient]);

  // Handle Add Money Checkout
  const handleProceedAddMoney = async () => {
    const num = Number(amountInput);
    if (isNaN(num) || num < 1) {
      setAddMoneyError('Please enter a valid amount (minimum ₹1).');
      return;
    }
    if (num > 100000) {
      setAddMoneyError('Maximum top-up amount is ₹1,00,000.');
      return;
    }

    setAddMoneyError(null);
    setIsInitiatingPayment(true);

    try {
      const preferredMode = (import.meta.env.VITE_CASHFREE_MODE || 'sandbox').toLowerCase();
      const returnUrl = `${window.location.origin}/wallet?topup_status=returned&cf_order_id={order_id}`;

      const res = await api.post('/wallet/topup/create-session', {
        amount: num,
        mode: preferredMode,
        returnUrl,
      });

      const { payment_session_id, environment } = res.data.data;
      if (!payment_session_id) {
        throw new Error('Failed to retrieve Cashfree payment session.');
      }

      const cfMode = (environment || preferredMode) === 'production' ? 'production' : 'sandbox';
      const cashfree = await load({ mode: cfMode });

      setAddMoneyOpen(false);
      await cashfree.checkout({
        paymentSessionId: payment_session_id,
        redirectTarget: '_self',
      });
    } catch (err: any) {
      setAddMoneyError(
        err.response?.data?.error?.message || err.message || 'Failed to start payment. Please try again.',
      );
      setIsInitiatingPayment(false);
    }
  };

  const currentBalanceRupees = walletInfo?.balanceRupees ?? ((user?.walletBalance ?? 0) / 100);
  const stats = walletInfo?.stats;
  const transactions = txnsData?.items || [];
  const pagination = txnsData?.pagination;

  if (!isAuthenticated) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Paper
          elevation={0}
          sx={{
            p: 6,
            borderRadius: '16px',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <AccountBalanceWallet sx={{ fontSize: 64, color: '#FF7900', mb: 2 }} />
          <Typography variant="h5" fontWeight={800} sx={{ mb: 1.5 }}>
            Sign in to access your Wallet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 450, mx: 'auto' }}>
            Top up your balance, earn automatic referral and upline commissions, and enjoy 1-click seamless checkout.
          </Typography>
          <Button
            variant="contained"
            component={RouterLink}
            to="/login"
            sx={{
              bgcolor: '#FF7900',
              color: 'white',
              fontWeight: 700,
              px: 4,
              py: 1.25,
              borderRadius: '8px',
              '&:hover': { bgcolor: '#E85D04' },
            }}
          >
            Sign In / Register
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      {/* Top Banner Feedbacks */}
      {isVerifyingTopup && (
        <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ mb: 3, borderRadius: '10px' }}>
          Verifying your wallet top-up payment with Cashfree. Please wait...
        </Alert>
      )}

      {topupFeedback && (
        <Alert
          severity={topupFeedback.type}
          onClose={() => setTopupFeedback(null)}
          sx={{ mb: 3, borderRadius: '10px' }}
        >
          {topupFeedback.message}
        </Alert>
      )}

      {/* Page Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} letterSpacing="-0.02em" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AccountBalanceWallet sx={{ color: '#FF7900', fontSize: '2rem' }} />
            My Wallet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage your balance, add funds, view commission earnings, and track order payments.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Refresh />}
            onClick={() => {
              refetchWallet();
              refetchTxns();
            }}
            sx={{
              flex: { xs: 1, sm: 'none' },
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              borderColor: 'divider',
              color: 'text.primary',
              py: 1,
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setAddMoneyError(null);
              setAddMoneyOpen(true);
            }}
            sx={{
              flex: { xs: 2, sm: 'none' },
              bgcolor: '#FF7900',
              color: 'white',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '8px',
              px: 2.5,
              py: 1,
              '&:hover': { bgcolor: '#E85D04' },
            }}
          >
            Add Money
          </Button>
        </Stack>
      </Box>

      {/* Top Section: Hero Balance Card + 3 Summary Cards */}
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2.5, sm: 4 } }}>
        {/* Main Balance Hero Card */}
        <Grid item xs={12} md={5}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, sm: 3.5 },
              borderRadius: '16px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              background: isLight
                ? 'linear-gradient(135deg, #172B30 0%, #0F1E22 100%)'
                : 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
              color: '#FFFFFF',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Background Decorative Rings */}
            <Box
              sx={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 140,
                height: 140,
                borderRadius: '50%',
                bgcolor: 'rgba(255, 121, 0, 0.12)',
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: -40,
                right: 30,
                width: 110,
                height: 110,
                borderRadius: '50%',
                bgcolor: 'rgba(255, 121, 0, 0.08)',
                pointerEvents: 'none',
              }}
            />

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Chip
                  label="E-Shopy Wallet"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255, 121, 0, 0.2)',
                    color: '#FF9E40',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    border: '1px solid rgba(255, 121, 0, 0.35)',
                  }}
                />
                <AccountBalanceWallet sx={{ color: '#FF7900', fontSize: '1.75rem' }} />
              </Box>

              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Total Available Balance
              </Typography>

              <Typography variant="h3" fontWeight={900} sx={{ mt: 0.5, mb: 1, letterSpacing: '-0.03em', color: '#FFFFFF', fontSize: { xs: '2rem', sm: '2.75rem' } }}>
                ₹{Number(currentBalanceRupees).toFixed(2)}
              </Typography>
            </Box>

            <Box sx={{ pt: 2, borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Button
                variant="contained"
                fullWidth
                size="medium"
                startIcon={<AddIcon />}
                onClick={() => {
                  setAddMoneyError(null);
                  setAddMoneyOpen(true);
                }}
                sx={{
                  bgcolor: '#FF7900',
                  color: 'white',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: '8px',
                  py: 1,
                  '&:hover': { bgcolor: '#E85D04' },
                }}
              >
                Add Money to Wallet
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* 3 Summary Stats Cards */}
        <Grid item xs={12} md={7}>
          <Grid container spacing={2.5} sx={{ height: '100%' }}>
            {/* 1. Commissions Earned */}
            <Grid item xs={12} sm={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '14px',
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    COMMISSIONS EARNED
                  </Typography>
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '8px',
                      bgcolor: 'rgba(255, 121, 0, 0.1)',
                      color: '#FF7900',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TrendingUp fontSize="small" />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ color: '#FF7900' }}>
                    ₹{(stats?.totalCommissionRupees ?? 0).toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Referral & Network margins
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* 2. Total Top-up Added */}
            <Grid item xs={12} sm={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '14px',
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    TOTAL TOP-UPS
                  </Typography>
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '8px',
                      bgcolor: 'rgba(22, 163, 74, 0.1)',
                      color: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ArrowDownward fontSize="small" />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ color: '#16a34a' }}>
                    ₹{(stats?.totalTopupRupees ?? 0).toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total loaded via Cashfree
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* 3. Total Spent on Orders */}
            <Grid item xs={12} sm={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '14px',
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    TOTAL SPENT
                  </Typography>
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '8px',
                      bgcolor: 'rgba(59, 130, 246, 0.1)',
                      color: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ShoppingCart fontSize="small" />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ color: '#3b82f6' }}>
                    ₹{(stats?.totalSpentRupees ?? 0).toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Purchases paid from wallet
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* Transactions History Section */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '16px',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        {/* Header & Tabs */}
        <Box sx={{ p: 2.5, pb: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <History sx={{ color: '#FF7900' }} />
              <Typography variant="h6" fontWeight={800}>
                Wallet Activity & Transactions
              </Typography>
            </Box>
            <Chip
              label={`${pagination?.total || 0} Total Records`}
              size="small"
              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
            />
          </Box>

          <Tabs
            value={activeTab}
            onChange={(_e, val) => {
              setActiveTab(val);
              setPage(1);
            }}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            textColor="inherit"
            sx={{
              minHeight: 44,
              '& .MuiTabs-indicator': { bgcolor: '#FF7900', height: 3 },
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                minHeight: 44,
                py: 1,
                px: { xs: 1.5, sm: 2 },
                color: 'text.secondary',
                whiteSpace: 'nowrap',
                '&.Mui-selected': { color: '#FF7900' },
              },
            }}
          >
            <Tab label="All Activity" value="all" />
            <Tab label="Commissions (+)" value="commission" />
            <Tab label="Top-ups (+)" value="topup" />
            <Tab label="Order Payments (-)" value="order_payment" />
          </Tabs>
        </Box>

        {/* Transactions Table */}
        {isLoadingTxns ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress size={36} sx={{ color: '#FF7900' }} />
          </Box>
        ) : transactions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
            <ReceiptLong sx={{ fontSize: 56, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="h6" fontWeight={700} color="text.secondary">
              No transactions found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mx: 'auto', mt: 0.5 }}>
              {activeTab === 'commission'
                ? 'Commissions earned from referral sales will appear here automatically.'
                : activeTab === 'topup'
                ? 'Funds added to your wallet via Cashfree will appear here.'
                : activeTab === 'order_payment'
                ? 'Purchases made using your wallet balance will appear here.'
                : 'Your wallet transaction history will appear here.'}
            </Typography>
          </Box>
        ) : (
          <>
            {/* Desktop Table View (Hidden on Mobile) */}
            <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead sx={{ bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase' }}>
                      Date & Time
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase' }}>
                      Type / Category
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase' }}>
                      Description
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase' }}>
                      Status
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase' }}>
                      Amount (₹)
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase' }}>
                      Balance After
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((txn: any) => {
                    const isCredit = txn.type === 'credit';
                    const formattedDate = new Date(txn.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <TableRow
                        key={txn._id || txn.transactionId}
                        sx={{
                          '&:hover': { bgcolor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' },
                        }}
                      >
                        {/* Date */}
                        <TableCell sx={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                          {formattedDate}
                        </TableCell>

                        {/* Category Chip */}
                        <TableCell>
                          <Chip
                            icon={
                              txn.category === 'commission' ? (
                                <MonetizationOn sx={{ fontSize: '1rem !important' }} />
                              ) : txn.category === 'topup' ? (
                                <AddIcon sx={{ fontSize: '1rem !important' }} />
                              ) : (
                                <ShoppingCart sx={{ fontSize: '1rem !important' }} />
                              )
                            }
                            label={
                              txn.category === 'commission'
                                ? 'Commission'
                                : txn.category === 'topup'
                                ? 'Top-up'
                                : txn.category === 'order_payment'
                                ? 'Order Payment'
                                : txn.category
                            }
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.725rem',
                              bgcolor:
                                txn.category === 'commission'
                                  ? 'rgba(255, 121, 0, 0.1)'
                                  : txn.category === 'topup'
                                  ? 'rgba(22, 163, 74, 0.1)'
                                  : 'rgba(59, 130, 246, 0.1)',
                              color:
                                txn.category === 'commission'
                                  ? '#FF7900'
                                  : txn.category === 'topup'
                                  ? '#16a34a'
                                  : '#3b82f6',
                              border: `1px solid ${
                                txn.category === 'commission'
                                  ? 'rgba(255, 121, 0, 0.25)'
                                  : txn.category === 'topup'
                                  ? 'rgba(22, 163, 74, 0.25)'
                                  : 'rgba(59, 130, 246, 0.25)'
                              }`,
                            }}
                          />
                        </TableCell>

                        {/* Description */}
                        <TableCell sx={{ fontSize: '0.85rem' }}>
                          <Typography variant="body2" fontWeight={600}>
                            {txn.description}
                          </Typography>
                          {txn.referenceId && (
                            <Typography variant="caption" color="text.secondary">
                              Ref: {txn.referenceId}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Chip
                            label={txn.status.toUpperCase()}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.675rem',
                              fontWeight: 800,
                              bgcolor:
                                txn.status === 'success'
                                  ? 'rgba(22, 163, 74, 0.12)'
                                  : txn.status === 'pending'
                                  ? 'rgba(234, 179, 8, 0.12)'
                                  : 'rgba(239, 68, 68, 0.12)',
                              color:
                                txn.status === 'success'
                                  ? '#16a34a'
                                  : txn.status === 'pending'
                                  ? '#ca8a04'
                                  : '#ef4444',
                            }}
                          />
                        </TableCell>

                        {/* Amount */}
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Typography
                            variant="body2"
                            fontWeight={800}
                            sx={{
                              color: isCredit ? '#16a34a' : '#ef4444',
                            }}
                          >
                            {isCredit ? '+' : '-'}₹{(txn.amountRupees ?? txn.amount / 100).toFixed(2)}
                          </Typography>
                        </TableCell>

                        {/* Balance After */}
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" fontWeight={600} color="text.secondary">
                            {txn.balanceAfterRupees !== undefined
                              ? `₹${Number(txn.balanceAfterRupees).toFixed(2)}`
                              : txn.balanceAfter !== undefined
                              ? `₹${(txn.balanceAfter / 100).toFixed(2)}`
                              : '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Mobile Card List View (Visible only on Mobile & Small Screens) */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              <Stack divider={<Divider sx={{ borderColor: 'divider' }} />}>
                {transactions.map((txn: any) => {
                  const isCredit = txn.type === 'credit';
                  const formattedDate = new Date(txn.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <Box
                      key={txn._id || txn.transactionId}
                      sx={{
                        p: 2,
                        transition: 'background-color 0.15s ease',
                        '&:active': { bgcolor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)' },
                      }}
                    >
                      {/* Top Row: Icon + Description + Amount */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1, minWidth: 0 }}>
                          {/* Category Icon */}
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '10px',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor:
                                txn.category === 'commission'
                                  ? 'rgba(255, 121, 0, 0.12)'
                                  : txn.category === 'topup'
                                  ? 'rgba(22, 163, 74, 0.12)'
                                  : 'rgba(59, 130, 246, 0.12)',
                              color:
                                txn.category === 'commission'
                                  ? '#FF7900'
                                  : txn.category === 'topup'
                                  ? '#16a34a'
                                  : '#3b82f6',
                            }}
                          >
                            {txn.category === 'commission' ? (
                              <MonetizationOn sx={{ fontSize: '1.2rem' }} />
                            ) : txn.category === 'topup' ? (
                              <ArrowDownward sx={{ fontSize: '1.2rem' }} />
                            ) : (
                              <ShoppingCart sx={{ fontSize: '1.2rem' }} />
                            )}
                          </Box>

                          {/* Description & Reference */}
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              sx={{
                                color: 'text.primary',
                                lineHeight: 1.35,
                                fontSize: '0.85rem',
                                wordBreak: 'break-word',
                              }}
                            >
                              {txn.description}
                            </Typography>
                            {txn.referenceId && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, fontSize: '0.72rem' }}>
                                Ref: {txn.referenceId}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Amount */}
                        <Typography
                          variant="body1"
                          fontWeight={900}
                          sx={{
                            color: isCredit ? '#16a34a' : '#ef4444',
                            fontSize: '0.975rem',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            textAlign: 'right',
                          }}
                        >
                          {isCredit ? '+' : '-'}₹{(txn.amountRupees ?? txn.amount / 100).toFixed(2)}
                        </Typography>
                      </Box>

                      {/* Bottom Row: Chips + Date + Balance After */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 1,
                          pl: '48px',
                          mt: 0.5,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                          <Chip
                            label={
                              txn.category === 'commission'
                                ? 'Commission'
                                : txn.category === 'topup'
                                ? 'Top-up'
                                : txn.category === 'order_payment'
                                ? 'Order Payment'
                                : txn.category
                            }
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              bgcolor:
                                txn.category === 'commission'
                                  ? 'rgba(255, 121, 0, 0.1)'
                                  : txn.category === 'topup'
                                  ? 'rgba(22, 163, 74, 0.1)'
                                  : 'rgba(59, 130, 246, 0.1)',
                              color:
                                txn.category === 'commission'
                                  ? '#ea580c'
                                  : txn.category === 'topup'
                                  ? '#16a34a'
                                  : '#2563eb',
                              borderRadius: '4px',
                            }}
                          />

                          <Chip
                            label={txn.status.toUpperCase()}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.625rem',
                              fontWeight: 800,
                              bgcolor:
                                txn.status === 'success'
                                  ? 'rgba(22, 163, 74, 0.1)'
                                  : txn.status === 'pending'
                                  ? 'rgba(234, 179, 8, 0.1)'
                                  : 'rgba(239, 68, 68, 0.1)',
                              color:
                                txn.status === 'success'
                                  ? '#16a34a'
                                  : txn.status === 'pending'
                                  ? '#ca8a04'
                                  : '#ef4444',
                              borderRadius: '4px',
                            }}
                          />
                        </Box>

                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', display: 'block' }}>
                            {formattedDate}
                          </Typography>
                          {(txn.balanceAfterRupees !== undefined || txn.balanceAfter !== undefined) && (
                            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem', fontWeight: 600 }}>
                              Bal: ₹{Number(txn.balanceAfterRupees ?? txn.balanceAfter / 100).toFixed(2)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          </>
        )}

        {/* Proper Table Pagination Toolbar */}
        {((pagination?.total ?? 0) > 0 || transactions.length > 0) && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              p: { xs: 2, sm: 2.5 },
              gap: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: isLight ? '#FAFAFA' : 'rgba(255, 255, 255, 0.02)',
            }}
          >
            {/* Left: Record Range & Rows per page */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500} fontSize="0.85rem">
                {pagination?.total
                  ? `Showing ${Math.min((page - 1) * rowsPerPage + 1, pagination.total)}–${Math.min(page * rowsPerPage, pagination.total)} of ${pagination.total} records`
                  : `Showing ${transactions.length} records`}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Rows per page:
                </Typography>
                <Select
                  size="small"
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  sx={{
                    fontSize: '0.8125rem',
                    height: 32,
                    bgcolor: 'background.paper',
                    '& .MuiSelect-select': { py: 0.5, px: 1.25 },
                  }}
                >
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                </Select>
              </Box>
            </Box>

            {/* Right: Page Navigation with Numbers, First/Prev/Next/Last */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Pagination
                count={Math.max(1, pagination?.totalPages || 1)}
                page={page}
                onChange={(_e, v) => setPage(v)}
                color="primary"
                shape="rounded"
                size={isMobile ? 'small' : 'medium'}
                showFirstButton
                showLastButton
                sx={{
                  '& .Mui-selected': { bgcolor: '#FF7900 !important', color: 'white', fontWeight: 800 },
                  '& .MuiPaginationItem-root:hover': {
                    bgcolor: isLight ? 'rgba(255, 121, 0, 0.1)' : 'rgba(255, 121, 0, 0.2)',
                  },
                }}
              />
            </Box>
          </Box>
        )}
      </Paper>

      {/* Add Money Modal / Dialog */}
      <Dialog
        open={addMoneyOpen}
        onClose={() => !isInitiatingPayment && setAddMoneyOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceWallet sx={{ color: '#FF7900' }} />
            <Typography variant="h6" fontWeight={800}>
              Add Money to Wallet
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setAddMoneyOpen(false)}
            disabled={isInitiatingPayment}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {addMoneyError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
              {addMoneyError}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add funds instantly to your E-Shopy wallet via Cashfree using UPI, Cards, Net Banking, or Wallets.
          </Typography>

          {/* Amount Input */}
          <TextField
            fullWidth
            type="number"
            label="Enter Amount"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            disabled={isInitiatingPayment}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography fontWeight={800} color="#FF7900" sx={{ fontSize: '1.25rem' }}>
                    ₹
                  </Typography>
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 2.5,
              '& .MuiOutlinedInput-root': {
                borderRadius: '10px',
                fontSize: '1.25rem',
                fontWeight: 800,
              },
            }}
          />

          {/* Quick Amount Suggestion Chips */}
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            OR SELECT POPULAR AMOUNT
          </Typography>
          <Grid container spacing={1} sx={{ mb: 3 }}>
            {['100', '250', '500', '1000', '2000', '5000'].map((amt) => (
              <Grid item xs={4} key={amt}>
                <Button
                  fullWidth
                  variant={amountInput === amt ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setAmountInput(amt)}
                  disabled={isInitiatingPayment}
                  sx={{
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    textTransform: 'none',
                    borderColor: 'divider',
                    color: amountInput === amt ? 'white' : 'text.primary',
                    bgcolor: amountInput === amt ? '#FF7900' : 'transparent',
                    '&:hover': {
                      bgcolor: amountInput === amt ? '#E85D04' : isLight ? '#F5F6F7' : 'rgba(255,255,255,0.06)',
                      borderColor: '#FF7900',
                    },
                  }}
                >
                  +₹{amt}
                </Button>
              </Grid>
            ))}
          </Grid>

          {/* Security Banner */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: '8px',
              bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.04)',
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <CheckCircle sx={{ color: '#16a34a', fontSize: '1.1rem' }} />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              100% Secure Checkout powered by Cashfree Payments
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleProceedAddMoney}
            disabled={isInitiatingPayment}
            startIcon={isInitiatingPayment ? <CircularProgress size={18} color="inherit" /> : <Payment />}
            sx={{
              bgcolor: '#FF7900',
              color: 'white',
              fontWeight: 700,
              py: 1.2,
              borderRadius: '8px',
              textTransform: 'none',
              fontSize: '0.95rem',
              '&:hover': { bgcolor: '#E85D04' },
            }}
          >
            {isInitiatingPayment ? 'Connecting to Payment Gateway...' : `Proceed to Pay ₹${amountInput || 0}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

