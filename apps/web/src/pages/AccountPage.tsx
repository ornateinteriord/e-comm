import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Divider,
  Stack,
  Chip,
  Card,
  CardContent,
  IconButton,
  Alert,
  Tooltip,
  MenuItem,
  Snackbar,
  Avatar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  useTheme,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Person as UserIcon,
  DeleteOutline as DeleteIcon,
  Add as AddIcon,
  AccountBalanceWallet as WalletIcon,
  ArrowForward as ArrowForwardIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Share as ShareIcon,
  Home as HomeIcon,
  Work as WorkIcon,
  Place as PlaceIcon,
  VerifiedUser as VerifiedIcon,
  PhotoCamera as PhotoCameraIcon,
  LockOutlined as LockIcon,
  MarkEmailRead as MarkEmailReadIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  QrCode2 as QrCode2Icon,
  ShoppingCart as ShoppingCartIcon,
  Shield as ShieldIcon,
  PendingActions as PendingActionsIcon,
  DeleteForever as DeleteForeverIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import CustomerReferralQrDialog from '../components/referral/CustomerReferralQrDialog';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';
import type { Address } from '@ornate/types';

export default function AccountPage() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user, setAuth } = useAuthStore();

  // Real-time user profile query (fetches updated level, token, name, customerId, etc.)
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/users/profile');
        const cust = data.data;
        if (cust) {
          const currentToken = useAuthStore.getState().accessToken;
          if (currentToken) {
            setAuth(currentToken, {
              ...user,
              ...cust,
              id: cust._id || cust.id || user?.id,
              name: cust.fullName || cust.name || user?.name,
              level: cust.level ?? 0,
              token: cust.token ?? 0,
            });
          }
        }
        return cust;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 10,
  });

  const effectiveUser = profile || user;
  const currentLevel = profile?.level ?? user?.level ?? 0;
  const currentTokens = (profile as any)?.token ?? (profile as any)?.tokens ?? (user as any)?.token ?? (user as any)?.tokens ?? 0;

  // Real-time wallet balance query
  const { data: walletData } = useQuery({
    queryKey: ['my-wallet-balance'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/wallet/balance');
        return data.data as { balance: number; balanceRupees: number };
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 15,
  });

  const walletBalancePaise = walletData?.balance ?? (effectiveUser?.walletBalance ?? 0);
  const walletBalanceRupees = (walletBalancePaise / 100).toFixed(2);

  // User phone helper (prefers mobileNumber, phone, or 10-digit username)
  const userPhone =
    effectiveUser?.mobileNumber ||
    effectiveUser?.phone ||
    (typeof effectiveUser?.username === 'string' && /^\d{10}$/.test(effectiveUser.username) ? effectiveUser.username : '') ||
    user?.mobileNumber ||
    user?.phone ||
    (typeof user?.username === 'string' && /^\d{10}$/.test(user.username) ? user.username : '') ||
    '';

  // Profile Edit State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('prefer_not_to_say');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Avatar Upload State
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Email Verification OTP State
  const [isEmailOtpDialogOpen, setIsEmailOtpDialogOpen] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEmailOtpDialogOpen) {
      setEmailOtp('');
      setOtpError(null);
      const t = setTimeout(() => {
        otpInputRef.current?.focus();
      }, 120);
      return () => clearTimeout(t);
    }
  }, [isEmailOtpDialogOpen]);

  const isEmailVerified = Boolean(effectiveUser?.isEmailVerified || effectiveUser?.emailVerified);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (effectiveUser) {
      setFullName(effectiveUser.fullName || effectiveUser.name || '');
      setEmail(effectiveUser.email || '');
      setGender(effectiveUser.gender || 'prefer_not_to_say');
      setCity(effectiveUser.city || '');
      setState(effectiveUser.state || '');
      setPincode(effectiveUser.pincode || '');
      setCountry(effectiveUser.country || 'India');
    }
  }, [
    effectiveUser?.fullName,
    effectiveUser?.name,
    effectiveUser?.email,
    effectiveUser?.gender,
    effectiveUser?.city,
    effectiveUser?.state,
    effectiveUser?.pincode,
    effectiveUser?.country,
  ]);

  // Copy referral feedback state & QR dialog state
  const [copied, setCopied] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const userCustomerId = effectiveUser?.customerId || (effectiveUser as any)?.customer_id || effectiveUser?.referralCode || '';

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.eshopy.biz';
  const referralLink = `${origin}/register?referralcode=${encodeURIComponent(userCustomerId)}`;

  const handleCopyReferral = () => {
    if (!userCustomerId) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareReferral = async () => {
    if (!userCustomerId) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join E-Shopy',
          text: `Shop on E-Shopy using my customer referral code ${userCustomerId} to unlock discounts & rewards!`,
          url: referralLink,
        });
        return;
      } catch {
        // Fallback to QR dialog
      }
    }
    setIsQrDialogOpen(true);
  };

  // Addresses Query & State
  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    name: effectiveUser?.fullName || effectiveUser?.name || user?.name || '',
    phone: userPhone,
    line1: '',
    line2: '',
    city: effectiveUser?.city || 'Bengaluru',
    state: effectiveUser?.state || 'Karnataka',
    pincode: effectiveUser?.pincode || '',
    isDefault: false,
  });
  const [showAddAddress, setShowAddAddress] = useState(false);

  // DPDP Act 2023: Customer Personal Data Deletion Request State
  const [isDeletionDialogOpen, setIsDeletionDialogOpen] = useState(false);
  const [deletionReasonType, setDeletionReasonType] = useState('privacy');
  const [customDeletionReason, setCustomDeletionReason] = useState('');
  const [deletionConfirmed, setDeletionConfirmed] = useState(false);
  const [deletionSuccess, setDeletionSuccess] = useState<string | null>(null);
  const [deletionError, setDeletionError] = useState<string | null>(null);

  const { data: deletionRequest, refetch: refetchDeletionRequest } = useQuery({
    queryKey: ['my-deletion-request'],
    queryFn: async () => {
      try {
        const res = await api.get('/privacy/deletion-request');
        return res.data?.data;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 30,
  });

  const submitDeletionMutation = useMutation({
    mutationFn: async () => {
      setDeletionError(null);
      const reasonMap: Record<string, string> = {
        privacy: 'Privacy concerns & personal data retention preference',
        not_using: 'No longer using E-Shopy account',
        duplicate: 'Duplicate or unwanted secondary account',
        other: customDeletionReason.trim() || 'Customer requested data erasure under DPDP Act',
      };
      const finalReason = reasonMap[deletionReasonType] || customDeletionReason.trim();
      const res = await api.post('/privacy/deletion-request', {
        reason: finalReason,
        notes: customDeletionReason.trim() ? customDeletionReason.trim() : undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      refetchDeletionRequest();
      setIsDeletionDialogOpen(false);
      setDeletionConfirmed(false);
      setCustomDeletionReason('');
      setDeletionSuccess('Your data deletion request has been submitted and is under compliance review.');
      setTimeout(() => setDeletionSuccess(null), 6000);
    },
    onError: (err: any) => {
      setDeletionError(err.response?.data?.error?.message || 'Failed to submit data deletion request.');
    },
  });

  const cancelDeletionMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete('/privacy/deletion-request');
      return res.data;
    },
    onSuccess: () => {
      refetchDeletionRequest();
      setDeletionSuccess('Your data deletion request has been cancelled.');
      setTimeout(() => setDeletionSuccess(null), 5000);
    },
  });

  useEffect(() => {
    if (effectiveUser) {
      setNewAddress((prev) => ({
        ...prev,
        name: prev.name || effectiveUser.fullName || effectiveUser.name || '',
        phone: userPhone || prev.phone || '',
        city: prev.city || effectiveUser.city || 'Bengaluru',
        state: prev.state || effectiveUser.state || 'Karnataka',
        pincode: prev.pincode || effectiveUser.pincode || '',
      }));
    }
  }, [effectiveUser, userPhone]);

  const { data: addresses, isLoading: isAddressesLoading } = useQuery<Address[]>({
    queryKey: ['my-addresses'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/addresses');
        return data.data;
      } catch {
        return [];
      }
    },
  });

  // Profile Picture Upload Handler
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setAvatarError('Image size exceeds 15MB limit.');
      return;
    }

    // Immediately show local image preview so Hero Banner and Profile Card update instantly
    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewAvatar(localPreviewUrl);

    setIsUploadingAvatar(true);
    setAvatarError(null);
    setAvatarSuccess(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('avatar', file);

      let resData: any = null;
      try {
        const res = await api.post('/users/profile/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        resData = res.data;
      } catch (postErr: any) {
        if (postErr.response?.status === 404) {
          const res = await api.post('/profile/avatar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          resData = res.data;
        } else {
          throw postErr;
        }
      }

      if (resData?.success) {
        const newUrl = resData.data.url || resData.data.avatar || resData.data.profilePicture;
        setPreviewAvatar(newUrl);

        // Update react-query cache synchronously so effectiveUser updates instantly without delay
        queryClient.setQueryData(['my-profile'], (old: any) =>
          old ? { ...old, avatar: newUrl, profilePicture: newUrl } : old,
        );
        queryClient.setQueryData(['auth-me-sync'], (old: any) =>
          old ? { ...old, avatar: newUrl, profilePicture: newUrl } : old,
        );

        if (user) {
          setAuth(useAuthStore.getState().accessToken || '', {
            ...user,
            avatar: newUrl,
            profilePicture: newUrl,
          });
        }
        queryClient.invalidateQueries({ queryKey: ['my-profile'] });
        queryClient.invalidateQueries({ queryKey: ['auth-me-sync'] });
        setAvatarSuccess('Profile picture updated successfully!');
        setTimeout(() => setAvatarSuccess(null), 4000);
      }
    } catch (err: any) {
      setAvatarError(err.response?.data?.error?.message || 'Failed to upload profile picture.');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Email Verification OTP Handlers (Nodemailer via ornateinteriord@gmail.com)
  const handleSendEmailOtp = async () => {
    const targetEmail = (isEmailVerified ? effectiveUser?.email : email || effectiveUser?.email || '').trim();
    if (!targetEmail) {
      setProfileError('Please enter a valid email address.');
      return;
    }

    setIsSendingOtp(true);
    setOtpError(null);
    setOtpSuccess(null);
    try {
      let resData: any = null;
      try {
        const res = await api.post('/users/send-email-otp', { email: targetEmail });
        resData = res.data;
      } catch (postErr: any) {
        if (postErr.response?.status === 404) {
          const res = await api.post('/send-email-otp', { email: targetEmail });
          resData = res.data;
        } else {
          throw postErr;
        }
      }

      if (resData?.success) {
        setIsEmailOtpDialogOpen(true);
        setResendCooldown(60);
        setOtpSuccess(resData.message || `A 6-digit code has been sent to ${targetEmail}`);
      }
    } catch (err: any) {
      setProfileError(err.response?.data?.error?.message || 'Failed to send verification email. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailOtp.trim() || emailOtp.trim().length !== 6) {
      setOtpError('Please enter a valid 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    try {
      let resData: any = null;
      try {
        const res = await api.post('/users/verify-email-otp', { otp: emailOtp.trim() });
        resData = res.data;
      } catch (postErr: any) {
        if (postErr.response?.status === 404) {
          const res = await api.post('/verify-email-otp', { otp: emailOtp.trim() });
          resData = res.data;
        } else {
          throw postErr;
        }
      }

      if (resData?.success) {
        if (user) {
          setAuth(useAuthStore.getState().accessToken || '', {
            ...user,
            email: (email || user.email || '').trim(),
            isEmailVerified: true,
            emailVerified: true,
          });
        }
        queryClient.invalidateQueries({ queryKey: ['my-profile'] });
        setIsEmailOtpDialogOpen(false);
        setEmailOtp('');
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 4000);
      }
    } catch (err: any) {
      setOtpError(err.response?.data?.error?.message || 'Invalid or expired verification code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      setProfileError(null);
      const payload: any = {
        name: fullName.trim(),
        fullName: fullName.trim(),
        gender,
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        country: country.trim(),
      };
      if (!isEmailVerified && email.trim()) {
        payload.email = email.trim();
      }
      const { data } = await api.put('/users/profile', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      if (user) {
        setAuth(useAuthStore.getState().accessToken || '', {
          ...user,
          name: fullName.trim(),
          fullName: fullName.trim(),
          ...(!isEmailVerified && email.trim() ? { email: email.trim() } : {}),
          gender: gender as any,
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          country: country.trim(),
        });
      }
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3500);
    },
    onError: (err: any) => {
      setProfileError(err?.response?.data?.error?.message || 'Failed to update profile. Please try again.');
    },
  });

  const addAddressMutation = useMutation({
    mutationFn: async () => {
      await api.post('/addresses', newAddress);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
      setNewAddress({
        label: 'Home',
        name: effectiveUser?.fullName || effectiveUser?.name || '',
        phone: userPhone,
        line1: '',
        line2: '',
        city: effectiveUser?.city || 'Bengaluru',
        state: effectiveUser?.state || 'Karnataka',
        pincode: effectiveUser?.pincode || '',
        isDefault: false,
      });
      setShowAddAddress(false);
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/addresses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/addresses/${id}/default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
    },
  });

  return (
    <Box sx={{ bgcolor: '#F8FAFC', minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="lg">
        {/* ==================== 1. HERO PROFILE BANNER ==================== */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            mb: 3.5,
            borderRadius: '20px',
            bgcolor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
            <Avatar
              src={previewAvatar || effectiveUser?.profilePicture || effectiveUser?.avatar || user?.profilePicture || user?.avatar}
              sx={{
                width: { xs: 64, md: 74 },
                height: { xs: 64, md: 74 },
                bgcolor: '#FF7900',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: { xs: '1.75rem', md: '2rem' },
                boxShadow: '0 6px 18px rgba(255, 121, 0, 0.35)',
                border: '3px solid #FFFFFF',
              }}
            >
              {(effectiveUser?.fullName || effectiveUser?.name || user?.name || 'C')?.[0]?.toUpperCase()}
            </Avatar>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                <Typography variant="h5" fontWeight={900} sx={{ color: '#0F172A', letterSpacing: '-0.02em' }}>
                  {effectiveUser?.fullName || effectiveUser?.name || 'Customer'}
                </Typography>
                <Chip
                  label={effectiveUser?.role?.toUpperCase() || 'CUSTOMER'}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255, 121, 0, 0.1)',
                    color: '#FF7900',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    border: '1px solid rgba(255, 121, 0, 0.25)',
                    height: 22,
                  }}
                />
                <Chip
                  icon={<VerifiedIcon sx={{ fontSize: '13px !important', color: '#16A34A !important' }} />}
                  label="Active Account"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(22, 163, 74, 0.1)',
                    color: '#16A34A',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    border: '1px solid rgba(22, 163, 74, 0.25)',
                    height: 22,
                  }}
                />
              </Box>

              <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <span>{effectiveUser?.email}</span>
                {effectiveUser?.mobileNumber && (
                  <>
                    <span>•</span>
                    <span>+91 {effectiveUser.mobileNumber}</span>
                  </>
                )}
                {userCustomerId && (
                  <>
                    <span>•</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>ID: {userCustomerId}</span>
                  </>
                )}
              </Typography>
            </Box>
          </Box>

          {/* Referral Link Quick Copy Button */}
          {userCustomerId && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                bgcolor: '#F8FAFC',
                p: 1.25,
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                width: { xs: '100%', md: 'auto' },
                justifyContent: { xs: 'space-between', md: 'flex-start' },
              }}
            >
              <Box sx={{ pl: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontWeight: 600, fontSize: '0.72rem' }}>
                  MY REFERRAL CODE
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A', letterSpacing: '0.04em' }}>
                  {userCustomerId}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setIsQrDialogOpen(true)}
                  startIcon={<QrCode2Icon />}
                  sx={{
                    borderColor: '#059669',
                    color: '#059669',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    borderRadius: '8px',
                    py: 0.75,
                    px: 1.5,
                    bgcolor: '#FFFFFF',
                    '&:hover': {
                      bgcolor: '#ECFDF5',
                      borderColor: '#047857',
                    },
                  }}
                >
                  QR Code
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleCopyReferral}
                  startIcon={copied ? <CheckIcon /> : <CopyIcon />}
                  sx={{
                    bgcolor: copied ? '#16A34A' : '#FF7900',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    borderRadius: '8px',
                    py: 0.75,
                    px: 1.5,
                    '&:hover': {
                      bgcolor: copied ? '#15803D' : '#E06B00',
                    },
                  }}
                >
                  {copied ? 'Link Copied!' : 'Copy Link'}
                </Button>
              </Stack>
            </Box>
          )}
        </Paper>

        {/* ==================== 2. HIGHLIGHTS ROW: WALLET + LEVEL + TOKEN ==================== */}
        <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
          {/* E-Shopy Wallet Card */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, sm: 3 },
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #132225 0%, #173238 60%, #1A3E45 100%)',
                color: '#FFFFFF',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 28px rgba(19, 34, 37, 0.25)',
                border: '1px solid rgba(255, 121, 0, 0.35)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {/* Background Glow Sphere */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -40,
                  right: -40,
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  bgcolor: 'rgba(255, 121, 0, 0.15)',
                  filter: 'blur(20px)',
                  pointerEvents: 'none',
                }}
              />

              <Box sx={{ position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '12px',
                        bgcolor: 'rgba(255, 121, 0, 0.22)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FF7900',
                        border: '1px solid rgba(255, 121, 0, 0.45)',
                      }}
                    >
                      <WalletIcon sx={{ fontSize: 22 }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={900} sx={{ color: '#FFFFFF', lineHeight: 1.2 }}>
                        E-Shopy Wallet
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Instant checkout & network margins
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    label="ACTIVE"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(16, 185, 129, 0.2)',
                      color: '#34D399',
                      border: '1px solid rgba(16, 185, 129, 0.45)',
                      fontWeight: 800,
                      fontSize: '0.675rem',
                      height: 22,
                    }}
                  />
                </Box>

                {/* Available Balance */}
                <Box sx={{ my: 1.5 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.75)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                    }}
                  >
                    Total Available Balance
                  </Typography>
                  <Typography
                    variant="h3"
                    fontWeight={900}
                    sx={{
                      color: '#FFFFFF',
                      mt: 0.5,
                      letterSpacing: '-0.02em',
                      fontSize: { xs: '2rem', sm: '2.5rem' },
                    }}
                  >
                    ₹{walletBalanceRupees}
                  </Typography>
                </Box>
              </Box>

              {/* Action Buttons */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2, position: 'relative', zIndex: 1 }}>
                <Button
                  component={RouterLink}
                  to="/wallet"
                  variant="contained"
                  fullWidth
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    bgcolor: '#FF7900',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    py: 1.1,
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontSize: '0.875rem',
                    boxShadow: '0 4px 14px rgba(255, 121, 0, 0.35)',
                    '&:hover': {
                      bgcolor: '#E85D04',
                      boxShadow: '0 6px 18px rgba(255, 121, 0, 0.45)',
                    },
                  }}
                >
                  View Wallet & Transactions
                </Button>
                <Button
                  component={RouterLink}
                  to="/wallet"
                  variant="outlined"
                  sx={{
                    color: '#FFFFFF',
                    borderColor: 'rgba(255, 255, 255, 0.35)',
                    fontWeight: 700,
                    py: 1.1,
                    px: 2.5,
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      borderColor: '#FF7900',
                      bgcolor: 'rgba(255, 121, 0, 0.12)',
                      color: '#FF7900',
                    },
                  }}
                >
                  + Add Money
                </Button>
              </Stack>
            </Paper>
          </Grid>

          {/* ================= LEVEL CARD (BESIDES TOKENS) ================= */}
          <Grid item xs={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: '20px',
                bgcolor: '#131F24',
                border: '1.5px solid rgba(59, 130, 246, 0.35)',
                boxShadow: '0 10px 28px rgba(0,0,0,0.22), 0 0 16px rgba(59, 130, 246, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: { xs: 190, md: 210 },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 14px 34px rgba(0,0,0,0.32), 0 0 25px rgba(59, 130, 246, 0.25)',
                  borderColor: '#60A5FA',
                },
              }}
            >
              {/* Background Ambient Glow */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '10%',
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: 'rgba(37, 99, 235, 0.25)',
                  filter: 'blur(22px)',
                  pointerEvents: 'none',
                }}
              />

              {/* 3D Circular Level Badge */}
              <Box
                sx={{
                  position: 'relative',
                  width: { xs: 78, sm: 90 },
                  height: { xs: 78, sm: 90 },
                  borderRadius: '50%',
                  p: '4px',
                  background: 'linear-gradient(135deg, #93C5FD 0%, #3B82F6 50%, #1D4ED8 100%)',
                  boxShadow:
                    '0 8px 24px rgba(37, 99, 235, 0.45), 0 2px 6px rgba(0,0,0,0.4), inset 0 2px 3px rgba(255,255,255,0.7), inset 0 -3px 5px rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1.5,
                }}
              >
                {/* Inner Level Rim */}
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 30%, #BFDBFE 0%, #2563EB 55%, #1E40AF 100%)',
                    border: '1.5px dashed rgba(255, 255, 255, 0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.3)',
                    position: 'relative',
                  }}
                >
                  {/* Top Shine Specular Highlight */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '10%',
                      left: '20%',
                      width: '60%',
                      height: '30%',
                      borderRadius: '50%',
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0))',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Level Number */}
                  <Typography
                    sx={{
                      fontWeight: 900,
                      fontSize: { xs: '1.9rem', sm: '2.4rem' },
                      color: '#FFFFFF',
                      lineHeight: 1,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      textShadow: '0 2px 4px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.6)',
                      userSelect: 'none',
                    }}
                  >
                    {currentLevel}
                  </Typography>
                </Box>
              </Box>

              {/* LEVEL Label */}
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: '0.9rem', sm: '1.05rem' },
                  letterSpacing: '0.1em',
                  color: '#93C5FD',
                  textTransform: 'uppercase',
                  textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                  userSelect: 'none',
                }}
              >
                LEVEL
              </Typography>
            </Paper>
          </Grid>

          {/* ================= TOKEN CARD (EXACT IMAGE REPLICA) ================= */}
          <Grid item xs={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: '20px',
                bgcolor: '#141E1C',
                border: '1.5px solid rgba(255, 179, 0, 0.4)',
                boxShadow: '0 10px 28px rgba(0,0,0,0.22), 0 0 16px rgba(255, 160, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: { xs: 190, md: 210 },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 14px 34px rgba(0,0,0,0.32), 0 0 25px rgba(255, 160, 0, 0.28)',
                  borderColor: '#FFA000',
                },
              }}
            >
              {/* Background Ambient Glow */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '10%',
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: 'rgba(255, 160, 0, 0.25)',
                  filter: 'blur(22px)',
                  pointerEvents: 'none',
                }}
              />

              {/* 3D Shiny Golden Coin */}
              <Box
                sx={{
                  position: 'relative',
                  width: { xs: 78, sm: 90 },
                  height: { xs: 78, sm: 90 },
                  borderRadius: '50%',
                  p: '4px',
                  background: 'linear-gradient(135deg, #FFE082 0%, #FFA000 50%, #C67100 100%)',
                  boxShadow:
                    '0 8px 24px rgba(255, 143, 0, 0.5), 0 2px 6px rgba(0,0,0,0.4), inset 0 2px 3px rgba(255,255,255,0.7), inset 0 -3px 5px rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1.5,
                }}
              >
                {/* Inner Coin Bevel Rim */}
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 30%, #FFE082 0%, #FFA000 55%, #E65100 100%)',
                    border: '1.5px dashed rgba(255, 255, 255, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.35)',
                    position: 'relative',
                  }}
                >
                  {/* Top Shine Specular Highlight */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '10%',
                      left: '20%',
                      width: '60%',
                      height: '30%',
                      borderRadius: '50%',
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(255,255,255,0))',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Token Count Number */}
                  <Typography
                    sx={{
                      fontWeight: 900,
                      fontSize: { xs: '1.9rem', sm: '2.4rem' },
                      color: '#FFFFFF',
                      lineHeight: 1,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      textShadow: '0 2px 4px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.6)',
                      userSelect: 'none',
                    }}
                  >
                    {currentTokens}
                  </Typography>
                </Box>
              </Box>

              {/* TOKENS Label */}
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: '0.9rem', sm: '1.05rem' },
                  letterSpacing: '0.1em',
                  color: '#FFD54F',
                  textTransform: 'uppercase',
                  textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                  userSelect: 'none',
                }}
              >
                TOKENS
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* ==================== 3. MAIN DASHBOARD CONTENT ==================== */}
        <Grid container spacing={3.5}>
          {/* LEFT COLUMN: PERSONAL PROFILE SETTINGS */}
          <Grid item xs={12} md={6}>
            <Stack spacing={3}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2.5, sm: 3.5 },
                  borderRadius: '20px',
                  bgcolor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#0F172A', lineHeight: 1.2 }}>
                      Personal Profile
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>
                      Update your account details and contact preferences
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ mb: 2.5 }} />

                {/* Profile Picture Upload Section */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2.5,
                    p: 2,
                    mb: 2.5,
                    borderRadius: '16px',
                    bgcolor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <Box sx={{ position: 'relative' }}>
                    <Avatar
                      src={previewAvatar || effectiveUser?.profilePicture || effectiveUser?.avatar || user?.profilePicture || user?.avatar}
                      sx={{
                        width: 72,
                        height: 72,
                        bgcolor: '#FF7900',
                        color: '#FFFFFF',
                        fontWeight: 900,
                        fontSize: '1.75rem',
                        border: '3px solid #FFFFFF',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                      }}
                    >
                      {(effectiveUser?.fullName || effectiveUser?.name || user?.name || 'C')?.[0]?.toUpperCase()}
                    </Avatar>
                    {isUploadingAvatar && (
                      <CircularProgress
                        size={78}
                        sx={{
                          position: 'absolute',
                          top: -3,
                          left: -3,
                          color: '#FF7900',
                          zIndex: 2,
                        }}
                      />
                    )}
                  </Box>

                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0F172A' }}>
                        Profile Picture
                      </Typography>
                      <Chip
                        label="Profile Photo"
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          bgcolor: 'rgba(59, 130, 246, 0.1)',
                          color: '#2563EB',
                          borderRadius: '6px',
                        }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1.2 }}>
                      Upload PNG, JPG or WEBP (Max 15MB)
                    </Typography>

                    <input
                      type="file"
                      ref={avatarInputRef}
                      style={{ display: 'none' }}
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={handleAvatarChange}
                    />

                    <Button
                      size="small"
                      variant="outlined"
                      disabled={isUploadingAvatar}
                      startIcon={isUploadingAvatar ? <CircularProgress size={14} color="inherit" /> : <PhotoCameraIcon />}
                      onClick={() => avatarInputRef.current?.click()}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        borderRadius: '8px',
                        py: 0.5,
                        px: 1.5,
                        borderColor: '#CBD5E1',
                        color: '#334155',
                        bgcolor: '#FFFFFF',
                        '&:hover': {
                          borderColor: '#FF7900',
                          color: '#FF7900',
                          bgcolor: 'rgba(255, 121, 0, 0.05)',
                        },
                      }}
                    >
                      {isUploadingAvatar ? 'Uploading photo…' : 'Upload Profile Picture'}
                    </Button>
                  </Box>
                </Box>

                {avatarSuccess && (
                  <Alert severity="success" sx={{ mb: 2, borderRadius: '10px', fontSize: '0.85rem' }}>
                    {avatarSuccess}
                  </Alert>
                )}

                {avatarError && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: '10px', fontSize: '0.85rem' }}>
                    {avatarError}
                  </Alert>
                )}

                {profileSuccess && (
                  <Alert severity="success" sx={{ mb: 2.5, borderRadius: '10px' }}>
                    Profile details updated successfully!
                  </Alert>
                )}

                {profileError && (
                  <Alert severity="error" sx={{ mb: 2.5, borderRadius: '10px' }}>
                    {profileError}
                  </Alert>
                )}

                <Stack spacing={2.5}>
                  <TextField
                    label="Full Name"
                    fullWidth
                    size="small"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name"
                  />

                  {/* Email Address (Editable if unverified, permanently locked once verified) */}
                  <Box>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: 1.5,
                      }}
                    >
                      <TextField
                        label="Email Address"
                        fullWidth
                        size="small"
                        disabled={isEmailVerified}
                        value={isEmailVerified ? effectiveUser?.email || '' : email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter email address"
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end" sx={{ mr: 0.5 }}>
                              <Box
                                sx={{
                                  bgcolor: isEmailVerified ? 'rgba(22, 163, 74, 0.12)' : '#E6F9F0',
                                  borderRadius: '8px',
                                  width: 34,
                                  height: 32,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <MarkEmailReadIcon
                                  sx={{
                                    color: isEmailVerified ? '#16A34A' : '#00B67A',
                                    fontSize: 20,
                                  }}
                                />
                              </Box>
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '10px',
                            height: 44,
                            bgcolor: isEmailVerified ? '#F8FAFC' : 'background.paper',
                            '&.Mui-disabled': {
                              color: '#0F172A',
                              WebkitTextFillColor: '#0F172A',
                            },
                          },
                          '& .MuiInputBase-input': {
                            fontSize: '0.925rem',
                            fontWeight: 500,
                          },
                        }}
                      />

                      {!isEmailVerified && (
                        <Button
                          variant="contained"
                          disabled={isSendingOtp || !email.trim()}
                          onClick={handleSendEmailOtp}
                          sx={{
                            bgcolor: '#FF7900',
                            color: '#FFFFFF',
                            fontWeight: 700,
                            fontSize: '0.925rem',
                            textTransform: 'none',
                            borderRadius: '10px',
                            px: 3,
                            height: 44,
                            width: { xs: '100%', sm: 'auto' },
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            boxShadow: 'none',
                            '&:hover': {
                              bgcolor: '#E06B00',
                              boxShadow: 'none',
                            },
                            '&.Mui-disabled': {
                              bgcolor: 'rgba(255, 121, 0, 0.4)',
                              color: '#FFFFFF',
                            },
                          }}
                        >
                          {isSendingOtp ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <CircularProgress size={14} color="inherit" />
                              <span>Sending…</span>
                            </Box>
                          ) : (
                            'Verify Email'
                          )}
                        </Button>
                      )}
                    </Box>

                    {/* Helper text with Info icon matching the design */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75, px: 0.5 }}>
                      <InfoIcon sx={{ fontSize: 16, color: '#64748B', flexShrink: 0 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#64748B',
                          fontSize: '0.78rem',
                          fontWeight: 500,
                          lineHeight: 1.4,
                        }}
                      >
                        {isEmailVerified
                          ? 'Email is verified and permanently linked to your account'
                          : 'Email is unverified. You can edit it or click "Verify Email" to verify.'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Mobile Number (Permanently locked) */}
                  <TextField
                    label="Mobile Number"
                    fullWidth
                    size="small"
                    disabled
                    value={userPhone ? `+91 ${userPhone}` : '+91 '}
                    helperText="Mobile number is permanently linked to your account"
                    InputProps={{
                      endAdornment: (
                        <Tooltip title="Mobile number cannot be edited">
                          <LockIcon sx={{ fontSize: 18, color: '#94A3B8' }} />
                        </Tooltip>
                      ),
                    }}
                    sx={{
                      '& .MuiInputBase-root.Mui-disabled': {
                        bgcolor: '#F8FAFC',
                        color: '#0F172A',
                        WebkitTextFillColor: '#0F172A',
                      },
                    }}
                  />

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        select
                        label="Gender"
                        fullWidth
                        size="small"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                      >
                        <MenuItem value="male">Male</MenuItem>
                        <MenuItem value="female">Female</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                        <MenuItem value="prefer_not_to_say">Prefer not to say</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Country"
                        fullWidth
                        size="small"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                      />
                    </Grid>
                  </Grid>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="City"
                        fullWidth
                        size="small"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="State"
                        fullWidth
                        size="small"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Pincode"
                        fullWidth
                        size="small"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                      />
                    </Grid>
                  </Grid>

                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => updateProfileMutation.mutate()}
                    disabled={updateProfileMutation.isPending}
                    sx={{
                      bgcolor: '#FF7900',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      py: 1.2,
                      borderRadius: '10px',
                      textTransform: 'none',
                      fontSize: '0.9rem',
                      boxShadow: '0 4px 14px rgba(255, 121, 0, 0.35)',
                      '&:hover': {
                        bgcolor: '#E06B00',
                        boxShadow: '0 6px 18px rgba(255, 121, 0, 0.45)',
                      },
                      mt: 1,
                    }}
                  >
                    {updateProfileMutation.isPending ? <CircularProgress size={22} color="inherit" /> : 'Save Profile Changes'}
                  </Button>
                </Stack>
              </Paper>
            </Stack>
          </Grid>

          {/* RIGHT COLUMN: SAVED ADDRESSES */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, sm: 3.5 },
                borderRadius: '20px',
                bgcolor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#0F172A', lineHeight: 1.2 }}>
                    Saved Delivery Addresses
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    {addresses?.length || 0} delivery locations configured
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant={showAddAddress ? 'outlined' : 'contained'}
                  startIcon={showAddAddress ? undefined : <AddIcon />}
                  onClick={() => setShowAddAddress(!showAddAddress)}
                  sx={{
                    bgcolor: showAddAddress ? 'transparent' : '#FF7900',
                    color: showAddAddress ? '#64748B' : '#FFFFFF',
                    borderColor: showAddAddress ? '#CBD5E1' : undefined,
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    '&:hover': {
                      bgcolor: showAddAddress ? '#F1F5F9' : '#E06B00',
                    },
                  }}
                >
                  {showAddAddress ? 'Cancel' : '+ Add Address'}
                </Button>
              </Box>

              <Divider sx={{ mb: 2.5 }} />

              {/* Add New Address Form Accordion */}
              {showAddAddress && (
                <Box
                  sx={{
                    p: 2.5,
                    mb: 3,
                    borderRadius: '14px',
                    bgcolor: '#F8FAFC',
                    border: '1.5px solid #E2E8F0',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2, color: '#0F172A' }}>
                    Enter New Delivery Address
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        select
                        label="Address Type"
                        fullWidth
                        size="small"
                        value={newAddress.label}
                        onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                      >
                        <MenuItem value="Home">Home</MenuItem>
                        <MenuItem value="Work">Work</MenuItem>
                        <MenuItem value="Other">Other</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={8}>
                      <TextField
                        label="Recipient Name"
                        fullWidth
                        size="small"
                        value={newAddress.name}
                        onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                        placeholder="Full name of receiver"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Phone Number"
                        required
                        fullWidth
                        size="small"
                        value={newAddress.phone || userPhone || ''}
                        onChange={(e) => {
                          const cleanDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setNewAddress({ ...newAddress, phone: cleanDigits });
                        }}
                        placeholder="10-digit mobile number"
                        helperText="Used for delivery notifications and SMS updates"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Flat, House no., Building, Apartment"
                        fullWidth
                        size="small"
                        value={newAddress.line1}
                        onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                        placeholder="Street address line 1"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Area, Colony, Street, Landmark"
                        fullWidth
                        size="small"
                        value={newAddress.line2}
                        onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })}
                        placeholder="Street address line 2 (optional)"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="City"
                        fullWidth
                        size="small"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="State"
                        fullWidth
                        size="small"
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Pincode"
                        fullWidth
                        size="small"
                        value={newAddress.pincode}
                        onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        variant="contained"
                        fullWidth
                        disabled={!newAddress.line1.trim() || !newAddress.name.trim() || addAddressMutation.isPending}
                        onClick={() => addAddressMutation.mutate()}
                        sx={{
                          bgcolor: '#FF7900',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          py: 1.1,
                          borderRadius: '8px',
                          textTransform: 'none',
                          '&:hover': { bgcolor: '#E06B00' },
                        }}
                      >
                        {addAddressMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Save Address'}
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Saved Addresses List */}
              <Stack spacing={2}>
                {addresses && addresses.length > 0 ? (
                  addresses.map((addr) => {
                    const id = addr.id || (addr as any)._id;
                    return (
                      <Card
                        key={id}
                        elevation={0}
                        sx={{
                          borderRadius: '14px',
                          border: addr.isDefault ? '1.5px solid #FF7900' : '1px solid #E2E8F0',
                          bgcolor: addr.isDefault ? 'rgba(255, 121, 0, 0.02)' : '#FFFFFF',
                          p: 2,
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: '#FF7900',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                              <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0F172A' }}>
                                {addr.name}
                              </Typography>
                              {addr.label && (
                                <Chip
                                  icon={addr.label.toLowerCase() === 'home' ? <HomeIcon sx={{ fontSize: '13px !important' }} /> : <WorkIcon sx={{ fontSize: '13px !important' }} />}
                                  label={addr.label.toUpperCase()}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    bgcolor: '#F1F5F9',
                                    color: '#475569',
                                  }}
                                />
                              )}
                              {addr.isDefault && (
                                <Chip
                                  label="DEFAULT"
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    bgcolor: '#FF7900',
                                    color: '#FFFFFF',
                                  }}
                                />
                              )}
                            </Box>

                            <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.5, mb: 0.5 }}>
                              {addr.line1}
                              {addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} - {addr.pincode}
                            </Typography>

                            <Typography variant="caption" sx={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PhoneIcon sx={{ fontSize: 13 }} />
                              Phone: {addr.phone}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                            {!addr.isDefault && (
                              <Button
                                size="small"
                                onClick={() => setDefaultMutation.mutate(id)}
                                sx={{
                                  fontSize: '0.75rem',
                                  textTransform: 'none',
                                  color: '#64748B',
                                  fontWeight: 700,
                                  '&:hover': { color: '#FF7900' },
                                }}
                              >
                                Set Default
                              </Button>
                            )}
                            <Tooltip title="Delete Address">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => deleteAddressMutation.mutate(id)}
                                sx={{
                                  '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      </Card>
                    );
                  })
                ) : isAddressesLoading ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : (
                  <Box
                    sx={{
                      py: 4,
                      textAlign: 'center',
                      bgcolor: '#F8FAFC',
                      borderRadius: '12px',
                      border: '1px dashed #CBD5E1',
                    }}
                  >
                    <LocationIcon sx={{ fontSize: 40, color: '#94A3B8', mb: 1 }} />
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#64748B' }}>
                      No saved addresses yet
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      Add an address above for fast 1-click checkout
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Paper>
          </Grid>

          {/* ================= FULL-WIDTH ROW: REFERRAL SHARING CARD ================= */}
          <Grid item xs={12}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, sm: 3.5 },
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                color: '#FFFFFF',
                boxShadow: '0 8px 24px rgba(5, 150, 105, 0.22)',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  alignItems: { xs: 'flex-start', md: 'center' },
                  justifyContent: 'space-between',
                  gap: 2.5,
                }}
              >
                {/* Left: Cart Icon, Refer a Customer, Code Pill, Subtitle */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '16px',
                      bgcolor: 'rgba(255, 255, 255, 0.22)',
                      backdropFilter: 'blur(6px)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <ShoppingCartIcon sx={{ fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                      <Typography variant="h6" fontWeight={800} sx={{ color: '#FFFFFF', lineHeight: 1.2, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                        Refer a Customer
                      </Typography>
                      <Chip
                        label={`Code: ${userCustomerId}`}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255, 255, 255, 0.25)',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          height: 26,
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.4)',
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.92)', mt: 0.5, fontSize: { xs: '0.82rem', sm: '0.875rem' } }}>
                      Share customer referral link to shop on E-shopy & earn rewards
                    </Typography>
                  </Box>
                </Box>

                {/* Right: QR Code + Copy Link + Share Buttons */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  sx={{ width: { xs: '100%', md: 'auto' } }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                    <Button
                      variant="contained"
                      size="medium"
                      onClick={() => setIsQrDialogOpen(true)}
                      startIcon={<QrCode2Icon />}
                      sx={{
                        bgcolor: '#FFFFFF',
                        color: '#059669',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        textTransform: 'none',
                        borderRadius: '10px',
                        py: 1.1,
                        px: 2.5,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                        flex: { xs: 1, sm: 'initial' },
                        minHeight: 44,
                        '&:hover': {
                          bgcolor: '#F0FDF4',
                        },
                      }}
                    >
                      QR Code
                    </Button>

                    <Button
                      variant="contained"
                      size="medium"
                      onClick={handleCopyReferral}
                      startIcon={copied ? <CheckIcon /> : <CopyIcon />}
                      sx={{
                        bgcolor: '#FFFFFF',
                        color: copied ? '#15803D' : '#059669',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        textTransform: 'none',
                        borderRadius: '10px',
                        py: 1.1,
                        px: 2.5,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                        flex: { xs: 1, sm: 'initial' },
                        minHeight: 44,
                        '&:hover': {
                          bgcolor: '#F0FDF4',
                        },
                      }}
                    >
                      {copied ? 'Link Copied!' : 'Copy Link'}
                    </Button>

                    <Tooltip title="Share on WhatsApp / Apps">
                      <IconButton
                        onClick={handleShareReferral}
                        sx={{
                          bgcolor: 'rgba(255, 255, 255, 0.2)',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          p: 1.2,
                          minWidth: 44,
                          minHeight: 44,
                          '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.35)',
                          },
                        }}
                      >
                        <ShareIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Box>

              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(255, 255, 255, 0.88)',
                  display: 'block',
                  mt: 2,
                  pt: 1.5,
                  borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                  lineHeight: 1.5,
                  fontSize: '0.8rem',
                }}
              >
                When someone registers with your referral code or scans your QR code, their purchases contribute to your network margins and token rewards automatically!
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* ==================== 4. DPDP PRIVACY & DATA ERASURE SECTION ==================== */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            mt: 3.5,
            mb: 4,
            borderRadius: '20px',
            bgcolor: '#FFFFFF',
            border: '1.5px solid #E2E8F0',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {deletionSuccess && (
            <Alert severity="success" sx={{ mb: 2.5, borderRadius: '10px' }} onClose={() => setDeletionSuccess(null)}>
              {deletionSuccess}
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  bgcolor: 'rgba(255, 121, 0, 0.1)',
                  color: '#FF7900',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  mt: 0.25,
                }}
              >
                <ShieldIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#0F172A', lineHeight: 1.3 }}>
                    Data Privacy & Account Erasure
                  </Typography>
                  <Chip
                    label="DPDP Act 2023 Compliant"
                    size="small"
                    sx={{
                      bgcolor: '#F1F5F9',
                      color: '#475569',
                      fontWeight: 700,
                      fontSize: '0.675rem',
                      height: 22,
                      border: '1px solid #CBD5E1',
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5, maxWidth: 780, lineHeight: 1.5 }}>
                  Under Section 12 of India's Digital Personal Data Protection (DPDP) Act, 2023, you have the right to request the erasure of your personal data held by E-Shopy. Upon execution, your personal identification, saved delivery locations, and wishlists will be permanently removed.
                </Typography>
              </Box>
            </Box>

            {/* If no pending request */}
            {(!deletionRequest || deletionRequest.status === 'cancelled' || deletionRequest.status === 'rejected') && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteForeverIcon />}
                onClick={() => {
                  setDeletionError(null);
                  setDeletionConfirmed(false);
                  setIsDeletionDialogOpen(true);
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '10px',
                  px: 2.5,
                  py: 1,
                  fontSize: '0.85rem',
                  borderColor: '#FECACA',
                  color: '#DC2626',
                  bgcolor: '#FEF2F2',
                  '&:hover': {
                    bgcolor: '#FEE2E2',
                    borderColor: '#F87171',
                  },
                }}
              >
                Request Data Erasure
              </Button>
            )}
          </Box>

          {/* Pending Status Banner */}
          {deletionRequest?.status === 'pending' && (
            <Box
              sx={{
                mt: 3,
                p: 2.5,
                borderRadius: '14px',
                bgcolor: '#FFFBEB',
                border: '1.5px solid #FDE68A',
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <PendingActionsIcon sx={{ color: '#D97706', fontSize: 26, mt: 0.25 }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#92400E' }}>
                    Data Deletion Request Under Compliance Review
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#B45309', display: 'block', mt: 0.25, lineHeight: 1.4 }}>
                    Submitted on {new Date(deletionRequest.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Reason: "{deletionRequest.reason}". Our compliance team is verifying this request.
                  </Typography>
                </Box>
              </Box>

              <Button
                size="small"
                variant="outlined"
                disabled={cancelDeletionMutation.isPending}
                onClick={() => cancelDeletionMutation.mutate()}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '8px',
                  borderColor: '#FCD34D',
                  color: '#92400E',
                  bgcolor: '#FFFFFF',
                  whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: '#FEF3C7', borderColor: '#F59E0B' },
                }}
              >
                {cancelDeletionMutation.isPending ? 'Cancelling…' : 'Cancel Request'}
              </Button>
            </Box>
          )}

          {/* Rejected Status Notice */}
          {deletionRequest?.status === 'rejected' && (
            <Box
              sx={{
                mt: 3,
                p: 2,
                borderRadius: '12px',
                bgcolor: '#FEF2F2',
                border: '1px solid #FECACA',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#991B1B' }}>
                Previous Deletion Request Notice
              </Typography>
              <Typography variant="body2" sx={{ color: '#7F1D1D', fontSize: '0.85rem', mt: 0.25 }}>
                Your previous deletion request was rejected with the following compliance note: "{deletionRequest.adminNotes || 'Active orders or obligations require settlement before erasure.'}"
              </Typography>
            </Box>
          )}

          {/* Completed Status Notice */}
          {deletionRequest?.status === 'completed' && (
            <Box
              sx={{
                mt: 3,
                p: 2,
                borderRadius: '12px',
                bgcolor: '#F0FDF4',
                border: '1px solid #BBF7D0',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#166534' }}>
                Personal Data Erased
              </Typography>
              <Typography variant="body2" sx={{ color: '#15803D', fontSize: '0.85rem', mt: 0.25 }}>
                Your personal identifying data has been erased in compliance with Section 12 of the DPDP Act, 2023.
              </Typography>
            </Box>
          )}
        </Paper>

        {/* ================= EMAIL VERIFICATION OTP MODAL (MINIMALIST) ================= */}
        <Dialog
          open={isEmailOtpDialogOpen}
          onClose={() => !isVerifyingOtp && setIsEmailOtpDialogOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '24px',
              p: { xs: 3, sm: 4 },
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.2)',
              position: 'relative',
              textAlign: 'center',
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'visible',
            },
          }}
        >
          {/* Subtle Dismiss '×' Button */}
          <IconButton
            size="small"
            disabled={isVerifyingOtp}
            onClick={() => setIsEmailOtpDialogOpen(false)}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: '#94A3B8',
              '&:hover': { color: '#0F172A', bgcolor: '#F1F5F9' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

          {/* Clean Rounded Icon */}
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              bgcolor: 'rgba(255, 121, 0, 0.08)',
              color: '#FF7900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5,
              mt: 0.5,
            }}
          >
            <EmailIcon sx={{ fontSize: 26 }} />
          </Box>

          {/* Clean Typography */}
          <Typography
            variant="h6"
            fontWeight={800}
            sx={{ color: '#0F172A', mb: 0.75, letterSpacing: '-0.02em', fontSize: '1.25rem' }}
          >
            Check your inbox
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.5, mb: 0.25, fontSize: '0.875rem' }}>
            We've sent a 6-digit verification code to
          </Typography>
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{ color: '#0F172A', mb: 2, wordBreak: 'break-all', fontSize: '0.9rem' }}
          >
            {(email || effectiveUser?.email || '').trim()}
          </Typography>

          {/* Inline Error Notice if any */}
          {otpError && (
            <Typography
              variant="caption"
              sx={{
                color: '#EF4444',
                fontWeight: 600,
                display: 'block',
                mb: 1.5,
                bgcolor: 'rgba(239, 68, 68, 0.08)',
                py: 0.6,
                px: 1.5,
                borderRadius: '8px',
                fontSize: '0.78rem',
              }}
            >
              {otpError}
            </Typography>
          )}

          {/* Modern 6-Slot OTP Display */}
          <Box
            onClick={() => otpInputRef.current?.focus()}
            sx={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              gap: { xs: 0.85, sm: 1.25 },
              cursor: 'text',
              my: 2,
            }}
          >
            <input
              ref={otpInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d*"
              maxLength={6}
              value={emailOtp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setEmailOtp(val);
                setOtpError(null);
              }}
              style={{
                position: 'absolute',
                opacity: 0,
                width: '100%',
                height: '100%',
                top: 0,
                left: 0,
                cursor: 'text',
                zIndex: 2,
              }}
            />

            {[0, 1, 2, 3, 4, 5].map((index) => {
              const digit = emailOtp[index] || '';
              const isFocused = emailOtp.length === index;
              const isCompleted = emailOtp.length === 6 && index === 5;
              return (
                <Box
                  key={index}
                  sx={{
                    width: { xs: 42, sm: 48 },
                    height: { xs: 50, sm: 56 },
                    borderRadius: '12px',
                    border: '1.5px solid',
                    borderColor: otpError
                      ? '#EF4444'
                      : isFocused || isCompleted
                      ? '#FF7900'
                      : digit
                      ? '#CBD5E1'
                      : '#E2E8F0',
                    bgcolor: otpError
                      ? 'rgba(239, 68, 68, 0.04)'
                      : isFocused
                      ? '#FFFFFF'
                      : '#F8FAFC',
                    boxShadow: isFocused ? '0 0 0 3px rgba(255, 121, 0, 0.14)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    transition: 'all 0.15s ease-in-out',
                    userSelect: 'none',
                  }}
                >
                  {digit}
                </Box>
              );
            })}
          </Box>

          {/* Full-width Confirm Button */}
          <Button
            fullWidth
            variant="contained"
            disabled={isVerifyingOtp || emailOtp.length !== 6}
            onClick={handleVerifyEmailOtp}
            sx={{
              bgcolor: '#FF7900',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.925rem',
              textTransform: 'none',
              borderRadius: '12px',
              py: 1.25,
              mt: 1.5,
              boxShadow: 'none',
              '&:hover': { bgcolor: '#E06B00', boxShadow: 'none' },
              '&.Mui-disabled': {
                bgcolor: '#F1F5F9',
                color: '#94A3B8',
              },
            }}
          >
            {isVerifyingOtp ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={18} color="inherit" />
                <span>Verifying…</span>
              </Box>
            ) : (
              'Verify & Confirm'
            )}
          </Button>

          {/* Resend Link */}
          <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.82rem' }}>
              Didn't receive the email?
            </Typography>
            <Button
              variant="text"
              size="small"
              disabled={resendCooldown > 0 || isSendingOtp || isVerifyingOtp}
              onClick={handleSendEmailOtp}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                p: 0,
                minWidth: 'auto',
                color: resendCooldown > 0 ? '#94A3B8' : '#FF7900',
                '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
              }}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </Button>
          </Box>
        </Dialog>

        {/* Customer Referral QR Code Dialog */}
        <CustomerReferralQrDialog
          open={isQrDialogOpen}
          onClose={() => setIsQrDialogOpen(false)}
          sponsorCode={userCustomerId}
          customerName={effectiveUser?.fullName || effectiveUser?.name || 'Customer'}
          customerAvatar={effectiveUser?.avatar || (effectiveUser as any)?.profilePicture || previewAvatar}
          referralLink={referralLink}
        />

        {/* ================= DPDP DATA ERASURE REQUEST MODAL ================= */}
        <Dialog
          open={isDeletionDialogOpen}
          onClose={() => !submitDeletionMutation.isPending && setIsDeletionDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '20px',
              p: { xs: 2.5, sm: 3.5 },
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.2)',
            },
          }}
        >
          <DialogTitle sx={{ p: 0, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  bgcolor: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <WarningIcon />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={800} sx={{ color: '#0F172A', lineHeight: 1.2 }}>
                  Request Personal Data Deletion
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748B' }}>
                  Under DPDP Act, 2023 (Section 12 - Right to Erasure)
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setIsDeletionDialogOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ p: 0 }}>
            {deletionError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
                {deletionError}
              </Alert>
            )}

            <Typography variant="body2" sx={{ color: '#334155', mb: 2, lineHeight: 1.5 }}>
              Submitting this request instructs our compliance officer to permanently erase your personal identifiable data from E-Shopy.
            </Typography>

            <Box sx={{ bgcolor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', p: 2, mb: 2.5 }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#991B1B', mb: 1 }}>
                Important Information Regarding Erasure:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#7F1D1D', fontSize: '0.85rem', lineHeight: 1.6 }}>
                <li>Your profile details (full name, email, phone number) will be scrubbed and anonymized.</li>
                <li>All saved delivery addresses and wishlist items will be permanently erased.</li>
                <li>Your account will be deactivated and cannot be logged back into.</li>
                <li>Financial transaction invoices will be retained in anonymized format as mandated by statutory GST and tax laws.</li>
              </ul>
            </Box>

            <Stack spacing={2} sx={{ mb: 2.5 }}>
              <TextField
                select
                label="Reason for Data Deletion"
                fullWidth
                size="small"
                value={deletionReasonType}
                onChange={(e) => setDeletionReasonType(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              >
                <MenuItem value="privacy">Privacy concerns & personal data retention preference</MenuItem>
                <MenuItem value="not_using">No longer using E-Shopy</MenuItem>
                <MenuItem value="duplicate">Duplicate or unwanted secondary account</MenuItem>
                <MenuItem value="other">Other reason</MenuItem>
              </TextField>

              {deletionReasonType === 'other' && (
                <TextField
                  label="Please specify reason"
                  required
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  value={customDeletionReason}
                  onChange={(e) => setCustomDeletionReason(e.target.value)}
                  placeholder="Tell us why you want to delete your personal data…"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              )}

              <FormControlLabel
                control={
                  <Checkbox
                    checked={deletionConfirmed}
                    onChange={(e) => setDeletionConfirmed(e.target.checked)}
                    color="error"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: '#334155', fontSize: '0.825rem', lineHeight: 1.4 }}>
                    I understand and confirm that this action will permanently erase my personal data and deactivate my account once approved.
                  </Typography>
                }
              />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 0, pt: 1, gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setIsDeletionDialogOpen(false)}
              disabled={submitDeletionMutation.isPending}
              sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 600, px: 2.5 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={
                submitDeletionMutation.isPending ||
                !deletionConfirmed ||
                (deletionReasonType === 'other' && !customDeletionReason.trim())
              }
              onClick={() => submitDeletionMutation.mutate()}
              startIcon={submitDeletionMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
              sx={{
                textTransform: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                px: 3,
                bgcolor: '#DC2626',
                '&:hover': { bgcolor: '#B91C1C' },
              }}
            >
              {submitDeletionMutation.isPending ? 'Submitting Request…' : 'Submit Deletion Request'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}