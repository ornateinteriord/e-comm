import { Router } from 'express';
import {
  getWalletBalance,
  getWalletTransactions,
  createWalletTopupSession,
  verifyWalletTopup,
  internalDebitWallet,
} from '../controllers/wallet.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router: Router = Router();

// Wallet balance & stats
router.get('/', requireAuth, getWalletBalance);
router.get('/balance', requireAuth, getWalletBalance);

// Transactions history
router.get('/transactions', requireAuth, getWalletTransactions);

// Top-up session & verification
router.post('/topup/create-session', requireAuth, createWalletTopupSession);
router.post('/topup/verify', requireAuth, verifyWalletTopup);

// Debit
router.post('/debit', requireAuth, internalDebitWallet);

export default router;

