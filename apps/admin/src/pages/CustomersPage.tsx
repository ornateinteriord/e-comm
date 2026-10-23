import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, CircularProgress,
} from '@mui/material';
import api from '../api/client';

export default function CustomersPage() {
  const { data: customersData, isLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['admin-customers-list'],
    queryFn: async () => {
      const { data } = await api.get('/admin/customers?limit=50');
      return data.data;
    },
  });

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={900} letterSpacing="-0.02em">
          Customer Directory
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Customer accounts, purchase histories, and contact profiles
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : !customersData?.items || customersData.items.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No registered customers yet.</Typography>
          </Box>
        ) : (
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Customer Name</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Email Address</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Phone Number</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Orders Placed</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Total Spent (₹)</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Registered On</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customersData.items.map((cust) => (
                <TableRow key={cust._id || cust.id} hover>
                  <TableCell sx={{ fontWeight: 800 }}>{cust.name}</TableCell>
                  <TableCell>{cust.email}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{cust.phone || 'N/A'}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{cust.totalOrders || 0}</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'primary.main' }}>
                    ₹{(((cust.totalSpent || 0) / 100)).toFixed(0)}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {new Date(cust.createdAt).toLocaleDateString()}
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
