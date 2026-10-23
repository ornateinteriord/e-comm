import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, CircularProgress, Tooltip,
} from '@mui/material';
import { Receipt as InvoiceIcon } from '@mui/icons-material';
import api from '../api/client';
import type { Invoice } from '@ornate/types';

export default function InvoicesPage() {
  const { data: invoicesData, isLoading } = useQuery<{ items: Invoice[]; total: number }>({
    queryKey: ['admin-invoices-list'],
    queryFn: async () => {
      const { data } = await api.get('/admin/invoices?limit=50');
      return data.data;
    },
  });

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={900} letterSpacing="-0.02em">
          Tax Invoices
        </Typography>
        <Typography variant="body2" color="text.secondary">
          GST-compliant tax invoices, line-item tax breakdowns (CGST + SGST), and billing archives
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : !invoicesData?.items || invoicesData.items.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No invoices generated yet.</Typography>
          </Box>
        ) : (
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Invoice #</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Order #</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Customer Name</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>GSTIN</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Total Tax (₹)</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Grand Total (₹)</TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoicesData.items.map((inv) => (
                <TableRow key={inv.id || inv.invoiceNumber} hover>
                  <TableCell sx={{ fontWeight: 800 }}>{inv.invoiceNumber}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{inv.orderNumber}</TableCell>
                  <TableCell>{new Date(inv.invoiceDate).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{inv.customerDetails?.name || '-'}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{inv.sellerDetails?.gstin || '-'}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>₹{((inv.totalTax / 100)).toFixed(2)}</TableCell>
                  <TableCell sx={{ fontWeight: 900, color: 'primary.main' }}>
                    ₹{((inv.grandTotal / 100)).toFixed(2)}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>
                    <Tooltip title="View & Print Official Tax Invoice">
                      <IconButton
                        size="small"
                        color="primary"
                        component="a"
                        href={`/api/v1/invoices/${inv.id || inv.invoiceNumber}/html`}
                        target="_blank"
                      >
                        <InvoiceIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
