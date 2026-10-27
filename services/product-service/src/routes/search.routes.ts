import { Router } from 'express';
import {
  searchProducts,
  getSuggestions,
  reindexAll,
} from '../controllers/search.controller.js';

const router: Router = Router();

router.get('/', searchProducts);
router.get('/suggestions', getSuggestions);
router.post('/reindex', reindexAll);

export default router;
