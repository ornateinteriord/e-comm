import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  AlertTitle,
  CircularProgress,
  Chip,
  Stack,
  Divider,
  Paper,
  IconButton,
  Tooltip,
  RadioGroup,
  FormControlLabel,
  Radio,
  Collapse,
} from '@mui/material';
import {
  Send as SendIcon,
  CheckCircle as SuccessIcon,
  ErrorOutline as ErrorIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Chat as WhatsAppIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import api from '../api/client';

interface MetaConfig {
  configured: boolean;
  phoneNumberId: string | null;
  appId: string | null;
  businessAccountId: string | null;
  apiVersion: string;
  hasToken: boolean;
  webhookVerifyToken?: string | null;
}

interface SendResponse {
  success: boolean;
  message?: string;
  recipient?: string;
  messageId?: string;
  data?: any;
  error?: {
    code?: string | number;
    message: string;
    details?: any;
    fbtrace_id?: string;
  };
}

const PRESET_MESSAGES = [
  '👋 Hello! This is a test message from E-Shopy WhatsApp integration.',
  '🛍️ Order Confirmed! Your order #ORD-1082 has been received and is being packed. Amount: ₹1,299. Thank you for shopping with E-Shopy!',
  '🚚 Dispatched! Your items have shipped via BlueDart. Tracking Number: BD-98231019. Delivery in 2-3 business days.',
];

export default function WhatsAppTestPage() {
  const [phone, setPhone] = useState('6361888927');
  const [message, setMessage] = useState(PRESET_MESSAGES[0]);
  const [messageType, setMessageType] = useState<'text' | 'template'>('template');
  const [templateName, setTemplateName] = useState('hello_world');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SendResponse | null>(null);
  const [config, setConfig] = useState<MetaConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await api.get('/notifications/whatsapp/config');
      if (res.data?.data) {
        setConfig(res.data.data);
      }
    } catch {
      // If config route is still loading or running dev
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/notifications/whatsapp/logs?limit=5');
      if (res.data?.data) {
        setRecentLogs(res.data.data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, []);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const payload: any = {
        phone: phone.trim(),
        type: messageType,
      };

      if (messageType === 'text') {
        payload.message = message.trim();
      } else {
        payload.templateName = templateName.trim() || 'hello_world';
        payload.languageCode = 'en_US';
      }

      const response = await api.post('/notifications/whatsapp/send', payload);
      setResult({
        success: true,
        message: response.data?.message || 'Message sent successfully!',
        recipient: response.data?.recipient,
        messageId: response.data?.messageId,
        data: response.data?.data,
      });
      fetchLogs();
    } catch (err: any) {
      const respData = err.response?.data;
      setResult({
        success: false,
        message: respData?.message || respData?.error?.message || err.message || 'Failed to dispatch message',
        error: respData?.error || { message: err.message },
        recipient: respData?.recipient,
        data: respData,
      });
    } finally {
      setLoading(false);
    }
  };

  // Derive webhook callback URL for current host or production
  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://eshopy.biz';
  const webhookCallbackUrl = `${currentHost}/api/v1/notifications/whatsapp/webhook`;
  const webhookVerifyToken =
    config?.webhookVerifyToken ||
    import.meta.env.VITE_WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    '';

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                bgcolor: '#25D366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
              }}
            >
              <WhatsAppIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} color="#0f172a">
                WhatsApp Integration Sandbox
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Test sending messages directly using Meta WhatsApp Cloud API credentials
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => {
            fetchConfig();
            fetchLogs();
          }}
          disabled={loadingConfig}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          Refresh Status
        </Button>
      </Stack>

      <Grid container spacing={3}>
        {/* Left Column: Form */}
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 3 }}>
            <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                Send Test Message
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter your WhatsApp mobile number and send a test message from your Meta Test Phone number (<strong>+1-555-141-5463</strong>).
              </Typography>

              <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                <AlertTitle sx={{ fontWeight: 800 }}>Why Free-form Text Might Not Arrive On Phone</AlertTitle>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                  Meta's WhatsApp Cloud API accepts requests (<code>message_status: accepted</code>), but <strong>strictly blocks delivery of free-form text</strong> to any number that has not messaged the business in the last 24 hours.
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                  👉 To receive the first message on your phone:
                </Typography>
                <Typography variant="caption" component="ol" sx={{ pl: 2, m: 0 }}>
                  <li>Select <strong>Meta Approved Template</strong> below (set to <code>hello_world</code>).</li>
                  <li>Click <strong>Send WhatsApp Message</strong>. It will be delivered to your WhatsApp immediately!</li>
                  <li>Reply <strong>"Hi"</strong> to the test number (<code>+1 555-141-5463</code>) on WhatsApp to open the 24-hr session.</li>
                  <li>After replying, you can switch to <strong>Free-form Text</strong> and all custom messages will arrive!</li>
                </Typography>
              </Alert>

              <Box component="form" onSubmit={handleSend}>
                {/* Recipient Phone Number */}
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
                  Recipient Mobile Number *
                </Typography>
                <TextField
                  fullWidth
                  placeholder="e.g. 9876543210 or 919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  helperText="Format: 10-digit number (auto-prepends +91) or international format without + or spaces"
                  sx={{ mb: 2.5 }}
                />

                {/* Message Mode */}
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
                  Message Type
                </Typography>
                <RadioGroup
                  row
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as 'text' | 'template')}
                  sx={{ mb: 2 }}
                >
                  <FormControlLabel
                    value="text"
                    control={<Radio color="primary" />}
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          Free-form Text Message
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Type any custom text message
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="template"
                    control={<Radio color="primary" />}
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          Meta Approved Template
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Uses Meta standard template (e.g. hello_world)
                        </Typography>
                      </Box>
                    }
                  />
                </RadioGroup>

                {/* Conditional Message Inputs */}
                {messageType === 'text' ? (
                  <Box sx={{ mb: 2.5 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        Message Body *
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {message.length} characters
                      </Typography>
                    </Stack>

                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      placeholder="Type your WhatsApp message here..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      sx={{ mb: 1.5 }}
                    />

                    {/* Preset Suggestions */}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Quick Templates:
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      <Chip
                        label="👋 Hello Greeting"
                        size="small"
                        clickable
                        onClick={() => setMessage(PRESET_MESSAGES[0])}
                      />
                      <Chip
                        label="🛍️ Order Confirmed"
                        size="small"
                        clickable
                        onClick={() => setMessage(PRESET_MESSAGES[1])}
                      />
                      <Chip
                        label="🚚 Order Dispatched"
                        size="small"
                        clickable
                        onClick={() => setMessage(PRESET_MESSAGES[2])}
                      />
                    </Stack>
                  </Box>
                ) : (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
                      Template Name
                    </Typography>
                    <TextField
                      fullWidth
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      helperText="Default Meta test template is 'hello_world' (approved on all WhatsApp Cloud accounts)"
                      sx={{ mb: 1.5 }}
                    />
                    <Alert severity="info" sx={{ py: 0.5, borderRadius: 2 }}>
                      <Typography variant="caption">
                        The <strong>hello_world</strong> template is pre-approved by Meta for every test account and does not require an active 24-hr session.
                      </Typography>
                    </Alert>
                  </Box>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={loading || !phone.trim() || (messageType === 'text' && !message.trim())}
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                  sx={{
                    bgcolor: '#25D366',
                    '&:hover': { bgcolor: '#1ea952' },
                    py: 1.5,
                    borderRadius: 2.5,
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: '1rem',
                  }}
                >
                  {loading ? 'Sending to Meta WhatsApp...' : 'Send WhatsApp Message'}
                </Button>
              </Box>

              {/* Result Notification */}
              {result && (
                <Box sx={{ mt: 3 }}>
                  {result.success ? (
                    <Alert
                      severity="success"
                      icon={<SuccessIcon fontSize="inherit" />}
                      sx={{ borderRadius: 2.5 }}
                    >
                      <AlertTitle sx={{ fontWeight: 800 }}>Message Dispatched Successfully!</AlertTitle>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Meta WhatsApp accepted the message. Check the recipient phone for incoming chat.
                      </Typography>
                      {result.messageId && (
                        <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          <strong>Meta Message ID:</strong> {result.messageId}
                        </Typography>
                      )}
                      {result.recipient && (
                        <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace' }}>
                          <strong>Normalized To:</strong> +{result.recipient}
                        </Typography>
                      )}
                    </Alert>
                  ) : (
                    <Alert
                      severity="error"
                      icon={<ErrorIcon fontSize="inherit" />}
                      sx={{ borderRadius: 2.5 }}
                    >
                      <AlertTitle sx={{ fontWeight: 800 }}>Dispatch Failed</AlertTitle>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {result.message}
                      </Typography>

                      {/* Diagnostic Guidance */}
                      {String(result.error?.code) === '131030' && (
                        <Box sx={{ bgcolor: 'rgba(255,255,255,0.8)', p: 1.5, borderRadius: 1.5, mt: 1, color: '#0f172a' }}>
                          <Typography variant="caption" fontWeight={700} display="block" color="#d32f2f">
                            ⚠️ Recipient phone number not in allowed test list:
                          </Typography>
                          <Typography variant="caption" display="block">
                            Because your Meta App is in <strong>Development mode</strong>, Meta only delivers to numbers you have whitelisted:
                          </Typography>
                          <Typography variant="caption" component="ol" sx={{ pl: 2, m: 0 }}>
                            <li>Go to Meta Developer Dashboard &gt; WhatsApp &gt; API Setup</li>
                            <li>Under <strong>To</strong> dropdown, click <strong>Manage phone number list</strong></li>
                            <li>Add this phone number and enter the SMS verification code from Meta.</li>
                          </Typography>
                        </Box>
                      )}

                      {String(result.error?.code) === '190' && (
                        <Box sx={{ bgcolor: 'rgba(255,255,255,0.8)', p: 1.5, borderRadius: 1.5, mt: 1, color: '#0f172a' }}>
                          <Typography variant="caption" fontWeight={700} display="block" color="#d32f2f">
                            ⚠️ Meta Access Token Expired or Invalid:
                          </Typography>
                          <Typography variant="caption" display="block">
                            Temporary 24h Meta tokens expire daily. Please generate a new System User Permanent Token in Meta Business Suite and update <code>WHATSAPP_TOKEN</code> in <code>.env</code>.
                          </Typography>
                        </Box>
                      )}

                      {String(result.error?.code) === '131047' && (
                        <Box sx={{ bgcolor: 'rgba(255,255,255,0.8)', p: 1.5, borderRadius: 1.5, mt: 1, color: '#0f172a' }}>
                          <Typography variant="caption" fontWeight={700} display="block" color="#d32f2f">
                            ⚠️ 24-Hour Customer Care Window Required:
                          </Typography>
                          <Typography variant="caption" display="block">
                            Free-form text can only be sent if the user messaged your WhatsApp number first within 24 hours. Switch to <strong>Meta Approved Template</strong> (hello_world) above to bypass this.
                          </Typography>
                        </Box>
                      )}

                      <Box sx={{ mt: 1.5 }}>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => setShowRawJson(!showRawJson)}
                          sx={{ textTransform: 'none', p: 0, fontSize: 11 }}
                        >
                          {showRawJson ? 'Hide Debug Details' : 'View Meta Debug Details'}
                        </Button>
                        <Collapse in={showRawJson}>
                          <Paper
                            sx={{
                              p: 1.5,
                              mt: 1,
                              bgcolor: '#0f172a',
                              color: '#94a3b8',
                              fontSize: 11,
                              fontFamily: 'monospace',
                              maxHeight: 200,
                              overflow: 'auto',
                            }}
                          >
                            <pre style={{ margin: 0 }}>
                              {JSON.stringify(result.error || result.data, null, 2)}
                            </pre>
                          </Paper>
                        </Collapse>
                      </Box>
                    </Alert>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: Credentials & Webhook Setup */}
        <Grid item xs={12} md={5}>
          {/* Active Credentials Card */}
          <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 3 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                Connected Meta Credentials
              </Typography>

              <Stack spacing={1.5}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    App ID
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                    2719957848437443
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Phone Number ID
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                    1490530494134515
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Messaging Account (WABA) ID
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                    1861063598359054
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Access Token Status
                      </Typography>
                      <Chip
                        label="Token Configured in .env"
                        size="small"
                        color="success"
                        sx={{ fontWeight: 700, height: 22, mt: 0.5 }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      v21.0
                    </Typography>
                  </Stack>
                </Paper>
              </Stack>
            </CardContent>
          </Card>

          {/* Webhook Configuration Card */}
          <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                Configure Webhooks in Meta
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: 13 }}>
                Paste these into your Meta App screen (<strong>Step 2. Production setup &gt; Configure Webhooks</strong>):
              </Typography>

              {/* Callback URL */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">
                  Callback URL
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 1,
                    pl: 1.5,
                    borderRadius: 2,
                    bgcolor: '#f8fafc',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: 'monospace', flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {webhookCallbackUrl}
                  </Typography>
                  <Tooltip title={copiedField === 'url' ? 'Copied!' : 'Copy Callback URL'}>
                    <IconButton size="small" onClick={() => handleCopy(webhookCallbackUrl, 'url')}>
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Paper>
              </Box>

              {/* Verify Token */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">
                  Verify Token
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 1,
                    pl: 1.5,
                    borderRadius: 2,
                    bgcolor: '#f8fafc',
                  }}
                >
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', flexGrow: 1 }}>
                    {webhookVerifyToken}
                  </Typography>
                  <Tooltip title={copiedField === 'token' ? 'Copied!' : 'Copy Verify Token'}>
                    <IconButton size="small" onClick={() => handleCopy(webhookVerifyToken, 'token')}>
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Paper>
              </Box>

              <Alert severity="info" sx={{ borderRadius: 2, py: 0.5 }}>
                <Typography variant="caption">
                  When deployed on your live server/domain (or ngrok for local dev), clicking <strong>Verify and save</strong> in Meta will verify instantly.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

