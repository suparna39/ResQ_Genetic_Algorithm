import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getAdminMetrics, getRecentRequests } from './admin.controller';

const router = Router();

// GET /api/admin/metrics — dashboard summary stats
router.get('/metrics', requireAuth, requireRole('admin'), getAdminMetrics);

// GET /api/admin/recent-requests — latest requests
router.get('/recent-requests', requireAuth, requireRole('admin'), getRecentRequests);

export default router;
