import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Stack,
  Alert,
  Divider,
  CircularProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  LocalShipping as LocalShippingIcon,
  Inventory as InventoryIcon,
  Cancel as CancelIcon,
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import api from '../api/client';

export default function WhatsAppTestPage() {
  const [phone, setPhone] = useState('916361888927');
  const [name, setName] = useState('Abu');
  const [orderNumber, setOrderNumber] = useState('ORD-' + Math.floor(100000 + Math.random() * 900000));
  const [customMessage, setCustomMessage] = useState('Hello! This is a test message from E-Shopy WhatsApp service.');

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const cleanPhone = (p: string) => {
    let cleaned = p.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    return cleaned;
  };

  const handleSendWelcome = async () => {
    const targetPhone = cleanPhone(phone);
    if (!targetPhone) return alert('Please enter phone number');
    setLoadingAction('welcome');
    setLastResponse(null);
    try {
      const res = await api.post('/notifications/welcome', {
        phone: targetPhone,
        name,
        customerId: 'CUST-' + Math.floor(1000 + Math.random() * 9000),
        loginUrl: 'https://eshopy.biz/login',
      });
      setLastResponse({ action: 'Welcome Message', status: 'success', data: res.data });
    } catch (err: any) {
      setLastResponse({
        action: 'Welcome Message',
        status: 'error',
        error: err.response?.data || err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendConfirmed = async () => {
    const targetPhone = cleanPhone(phone);
    if (!targetPhone) return alert('Please enter phone number');
    setLoadingAction('confirmed');
    setLastResponse(null);
    try {
      const res = await api.post('/notifications/order-confirmed', {
        phone: targetPhone,
        name,
        orderNumber,
        grandTotal: 149900, // in paise
        items: [{ name: 'Handcrafted Interior Décor Artifact', quantity: 1, unitPrice: 149900 }],
        paymentMethod: 'Prepaid / Online',
      });
      setLastResponse({ action: 'Order Confirmed', status: 'success', data: res.data });
    } catch (err: any) {
      setLastResponse({
        action: 'Order Confirmed',
        status: 'error',
        error: err.response?.data || err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendDispatched = async () => {
    const targetPhone = cleanPhone(phone);
    if (!targetPhone) return alert('Please enter phone number');
    setLoadingAction('dispatched');
    setLastResponse(null);
    try {
      const res = await api.post('/notifications/order-dispatched', {
        phone: targetPhone,
        name,
        orderNumber,
        courierName: 'BlueDart Express',
        trackingNumber: 'BD' + Math.floor(100000000 + Math.random() * 900000000) + 'IN',
        trackingUrl: 'https://track.eshopy.biz/' + orderNumber,
      });
      setLastResponse({ action: 'Order Dispatched', status: 'success', data: res.data });
    } catch (err: any) {
      setLastResponse({
        action: 'Order Dispatched',
        status: 'error',
        error: err.response?.data || err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendDelivered = async () => {
    const targetPhone = cleanPhone(phone);
    if (!targetPhone) return alert('Please enter phone number');
    setLoadingAction('delivered');
    setLastResponse(null);
    try {
      const res = await api.post('/notifications/order-delivered', {
        phone: targetPhone,
        name,
        orderNumber,
      });
      setLastResponse({ action: 'Order Delivered', status: 'success', data: res.data });
    } catch (err: any) {
      setLastResponse({
        action: 'Order Delivered',
        status: 'error',
        error: err.response?.data || err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendCancelled = async () => {
    const targetPhone = cleanPhone(phone);
    if (!targetPhone) return alert('Please enter phone number');
    setLoadingAction('cancelled');
    setLastResponse(null);
    try {
      const res = await api.post('/notifications/order-cancelled', {
        phone: targetPhone,
        name,
        orderNumber,
        reason: 'Customer requested cancellation via portal',
        refundRupees: '1499.00',
      });
      setLastResponse({ action: 'Order Cancelled', status: 'success', data: res.data });
    } catch (err: any) {
      setLastResponse({
        action: 'Order Cancelled',
        status: 'error',
        error: err.response?.data || err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendCustomText = async () => {
    const targetPhone = cleanPhone(phone);
    if (!targetPhone) return alert('Please enter phone number');
    if (!customMessage.trim()) return alert('Please enter message text');
    setLoadingAction('custom');
    setLastResponse(null);
    try {
      const res = await api.post('/notifications/whatsapp/send', {
        phone: targetPhone,
        message: customMessage,
        type: 'text',
      });
      setLastResponse({ action: 'Custom Text Message', status: 'success', data: res.data });
    } catch (err: any) {
      setLastResponse({
        action: 'Custom Text Message',
        status: 'error',
        error: err.response?.data || err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendTemplate = async () => {
    const targetPhone = cleanPhone(phone);
    if (!targetPhone) return alert('Please enter phone number');
    setLoadingAction('template');
    setLastResponse(null);
    try {
      const res = await api.post('/notifications/whatsapp/send', {
        phone: targetPhone,
        type: 'template',
        templateName: 'hello_world',
        languageCode: 'en_US',
      });
      setLastResponse({ action: 'Template hello_world', status: 'success', data: res.data });
    } catch (err: any) {
      setLastResponse({
        action: 'Template hello_world',
        status: 'error',
        error: err.response?.data || err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const fetchRecentLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get('/notifications/whatsapp/logs?limit=10');
      setRecentLogs(res.data?.data || []);
    } catch (err: any) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }} elevation={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>
            WhatsApp Notification Test Page
          </Typography>
          <Chip label="Developer Tool" color="warning" size="small" />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter a mobile number to trigger live WhatsApp messages and lifecycle order statuses.
        </Typography>

        {/* Inputs */}
        <Stack spacing={2} sx={{ mb: 3 }}>
          <TextField
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="916361888927"
            helperText="Include country code (e.g., 91 followed by 10 digits)"
            fullWidth
            required
            size="small"
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Recipient Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Order Number (for status messages)"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              fullWidth
              size="small"
            />
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Action Buttons */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: '#FF7900' }}>
          1. Customer Welcome Message
        </Typography>
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={loadingAction === 'welcome' ? <CircularProgress size={18} color="inherit" /> : <PersonAddIcon />}
            onClick={handleSendWelcome}
            disabled={Boolean(loadingAction)}
            sx={{ bgcolor: '#FF7900', '&:hover': { bgcolor: '#E85D04' } }}
          >
            Send Welcome Message
          </Button>
        </Box>

        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: '#FF7900' }}>
          2. Order Delivery Lifecycle Statuses
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
          <Button
            variant="outlined"
            color="success"
            startIcon={loadingAction === 'confirmed' ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
            onClick={handleSendConfirmed}
            disabled={Boolean(loadingAction)}
          >
            Order Confirmed
          </Button>

          <Button
            variant="outlined"
            color="info"
            startIcon={loadingAction === 'dispatched' ? <CircularProgress size={18} color="inherit" /> : <LocalShippingIcon />}
            onClick={handleSendDispatched}
            disabled={Boolean(loadingAction)}
          >
            Order Dispatched
          </Button>

          <Button
            variant="outlined"
            color="secondary"
            startIcon={loadingAction === 'delivered' ? <CircularProgress size={18} color="inherit" /> : <InventoryIcon />}
            onClick={handleSendDelivered}
            disabled={Boolean(loadingAction)}
          >
            Order Delivered
          </Button>

          <Button
            variant="outlined"
            color="error"
            startIcon={loadingAction === 'cancelled' ? <CircularProgress size={18} color="inherit" /> : <CancelIcon />}
            onClick={handleSendCancelled}
            disabled={Boolean(loadingAction)}
          >
            Order Cancelled
          </Button>
        </Stack>

        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: '#FF7900' }}>
          3. Custom Text & Template Message
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            label="Custom Message Text"
            multiline
            rows={2}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            fullWidth
            size="small"
          />
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={loadingAction === 'custom' ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              onClick={handleSendCustomText}
              disabled={Boolean(loadingAction)}
            >
              Send Custom Text
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleSendTemplate}
              disabled={Boolean(loadingAction)}
            >
              Send Template (hello_world)
            </Button>
          </Stack>
        </Stack>

        {/* Live Response Box */}
        {lastResponse && (
          <Box sx={{ mt: 3 }}>
            <Alert severity={lastResponse.status === 'success' ? 'success' : 'error'} sx={{ mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {lastResponse.action}: {lastResponse.status.toUpperCase()}
              </Typography>
            </Alert>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#0f172a', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.8rem', overflowX: 'auto' }}>
              <pre style={{ margin: 0 }}>{JSON.stringify(lastResponse.data || lastResponse.error, null, 2)}</pre>
            </Paper>
          </Box>
        )}
      </Paper>

      {/* Logs Accordion */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between', pr: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Recent WhatsApp Logs
            </Typography>
            <Button
              size="small"
              startIcon={loadingLogs ? <CircularProgress size={14} /> : <RefreshIcon />}
              onClick={(e) => {
                e.stopPropagation();
                fetchRecentLogs();
              }}
            >
              Refresh
            </Button>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {recentLogs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Click 'Refresh' to load the latest WhatsApp logs from MongoDB.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {recentLogs.map((log: any, idx: number) => (
                <Paper key={log._id || idx} variant="outlined" sx={{ p: 1.5, fontSize: '0.85rem' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {log.type} → {log.recipient}
                    </Typography>
                    <Chip
                      label={log.deliveryStatus || log.status}
                      size="small"
                      color={
                        log.deliveryStatus === 'read' || log.deliveryStatus === 'delivered' || log.status === 'sent'
                          ? 'success'
                          : log.deliveryStatus === 'failed' || log.status === 'failed'
                          ? 'error'
                          : 'default'
                      }
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {log.body}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                    {log.whatsappMessageId && ` • ID: ${log.whatsappMessageId}`}
                  </Typography>
                  {log.metadata?.error && (
                    <Typography variant="caption" color="error.main" display="block" sx={{ mt: 0.5 }}>
                      Error: {log.metadata.error.message || JSON.stringify(log.metadata.error)}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
          )}
        </AccordionDetails>
      </Accordion>
    </Container>
  );
}
