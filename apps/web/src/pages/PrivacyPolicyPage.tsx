import { Container, Typography, Paper, Box, Divider, Stack } from '@mui/material';
import { Shield as ShieldIcon } from '@mui/icons-material';

export default function PrivacyPolicyPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 6 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <ShieldIcon sx={{ color: '#FF7900', fontSize: 28 }} />
          <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary', letterSpacing: '-0.02em' }}>
            Privacy Policy
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 3 }}>
          Effective Date: October 16, 2026 | Version 2.1
        </Typography>

        <Divider sx={{ mb: 4 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', mb: 1 }}>
              1. Overview and Scope
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              E-Shophy Store Private Limited ("E-Shophy", "we", "us", or "our") respects your privacy and is dedicated to safeguarding your personal data. This Privacy Policy details how we collect, process, store, and protect your information when you access our customer storefront, admin interfaces, and API services.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', mb: 1 }}>
              2. Information We Collect
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              We collect information necessary to fulfill commercial transactions and maintain secure user accounts:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mt: 1, color: '#475569', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <li><strong>Personal Identifiers:</strong> Name, verified email address, phone number, and account credentials.</li>
              <li><strong>Delivery & Billing Data:</strong> Full physical shipping addresses, state, postal pincode, and contact recipient details.</li>
              <li><strong>Transactional Data:</strong> Order line items, payment settlement identifiers (via Razorpay), and generated GST tax invoice records.</li>
              <li><strong>Technical Identifiers:</strong> IP addresses, browser client fingerprints, session tokens, and operational access audit logs.</li>
            </Box>
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', mb: 1 }}>
              3. Purpose and Legal Basis for Processing
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              Your personal information is collected and processed strictly under lawful commercial grounds:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mt: 1, color: '#475569', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <li>To execute purchases, process secure payments, and coordinate carrier shipping logistics.</li>
              <li>To automatically generate and archive statutory Goods and Services Tax (GST) invoices.</li>
              <li>To verify customer accounts, detect fraudulent transactions, and prevent unauthorized account access.</li>
              <li>To communicate real-time order tracking notifications and fulfillment milestones.</li>
            </Box>
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', mb: 1 }}>
              4. Payment Security & Data Transmission
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              E-Shophy does not store complete credit card or debit card numbers on our local databases. All electronic payments are processed directly through PCI-DSS Level 1 compliant gateway partners (Razorpay). Sensitive transmission data is secured using industry standard Transport Layer Security (TLS 1.3) with encrypted database connections.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', mb: 1 }}>
              5. Data Retention & User Rights
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              Account data is maintained as long as your account remains active. Financial and taxation records (invoices, audit logs) are archived for seven (7) years to comply with statutory taxation requirements under Indian law. Registered customers may request account deletion, review held information, or update contact coordinates at any time via their account portal or by contacting privacy@ornate.dev.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', mb: 1 }}>
              6. Grievance Officer & Contact
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              In accordance with the Information Technology Act, 2000 and rules made thereunder, questions or grievances regarding data protection may be directed to:
              <br />
              <strong>Grievance Officer:</strong> Legal & Compliance Desk
              <br />
              <strong>Address:</strong> E-Shophy Store Pvt Ltd, Bandra Kurla Complex, Mumbai, Maharashtra 400051
              <br />
              <strong>Email:</strong> legal@e-shophy.dev
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
