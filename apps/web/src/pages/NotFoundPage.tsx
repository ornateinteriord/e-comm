import { Container, Typography, Button, Paper } from '@mui/material';
import { Link as RouterLink } from 'react-router';

export default function NotFoundPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 14, textAlign: 'center' }}>
      <Paper elevation={0} sx={{ p: 6, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h1" fontWeight={900} color="primary" sx={{ fontSize: '5rem', mb: 1 }}>
          404
        </Typography>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>Page Not Found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </Typography>
        <Button variant="contained" component={RouterLink} to="/" size="large" sx={{ borderRadius: 2, fontWeight: 700 }}>
          Back to Store Home
        </Button>
      </Paper>
    </Container>
  );
}
