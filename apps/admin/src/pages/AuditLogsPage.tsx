import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, CircularProgress,
} from '@mui/material';
import api from '../api/client';
import type { AuditLog } from '@ornate/types';

export default function AuditLogsPage() {
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/admin/audit-logs');
        return data.data;
      } catch {
        return [];
      }
    },
  });

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={900} letterSpacing="-0.02em">
          System Audit Trail
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Security events, administrative role updates, and pricing modifications
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : !logs || logs.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No audit logs recorded yet.</Typography>
          </Box>
        ) : (
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Target Model</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Target ID</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Actor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip label={log.action} size="small" color="primary" sx={{ fontWeight: 700, fontSize: 11 }} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{log.targetModel}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{log.targetId}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{log.actorId || 'system'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
