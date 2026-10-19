import { Container, Typography, Paper, Box, Divider, Stack } from '@mui/material';
import { Gavel as GavelIcon } from '@mui/icons-material';

export default function TermsPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 6 },
          borderRadius: 2,
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <GavelIcon sx={{ color: '#2563eb', fontSize: 28 }} />
          <Typography variant="h4" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
            Terms & Conditions
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 3 }}>
          Effective Date: October 16, 2026 | Version 2.1
        </Typography>

        <Divider sx={{ mb: 4 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>
              1. Acceptance of Terms
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              These Terms and Conditions constitute a legally binding agreement between you and Ornate Store Private Limited ("Ornate", "we", "us"). By registering an account, browsing products, or completing an order on this platform, you acknowledge and agree to comply with all provisions detailed herein.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>
              2. Catalog Pricing, Taxes & 4-Tier Structure
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              All product listings display transparent 4-tier pricing information where applicable: Maximum Retail Price (MRP), current Selling Price, and promotional Special Deal Rates. Prices are quoted in Indian Rupees (INR) and are inclusive of statutory 18% Goods and Services Tax (GST). Inward procurement costs are strictly reserved for verified internal administrative review and are never exposed publicly.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>
              3. Order Placement, Verification & Invoicing
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              An order placed through our checkout constitutes an offer to purchase. Contracts are concluded once payment verification is confirmed by our gateway service and an official Tax Invoice Number is generated. Invoices comply with Indian GST rules (HSN codes, CGST/SGST/IGST breakdown) and are downloadable directly from the customer order history portal.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>
              4. Inventory Allocation & Fulfillment
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              Inventory is reserved in real time upon successful order initiation. In the event of an unexpected warehouse discrepancy or out-of-stock condition, customers will receive immediate notification with the option of an expedited restocking window or a 100% refund settled back to the original payment method within 3 to 5 business days.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>
              5. Returns, Replacements & Warranty
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              Products delivered with transit damage, manufacturing defects, or specification mismatches are eligible for our 7-Day Return and Replacement Policy. Returned items must remain in their original condition, accompanied by all manufacturer accessories, authentic packaging, and original tax invoices. All electronic items carry standard manufacturer warranty coverage honored through authorized brand service centers.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>
              6. Governing Law & Jurisdiction
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              These terms shall be governed by and construed in accordance with the laws of India. Any legal dispute, proceeding, or arbitration arising out of or related to our platform shall be subject exclusively to the courts of competent jurisdiction located in Mumbai, Maharashtra, India.
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
