import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { updateTracking, getTrackingHistory } from './tracking.controller';
import { z } from 'zod';

const router = Router();

const trackingUpdateSchema = z.object({
  assignment_id: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// POST /api/tracking/update — driver sends GPS
router.post(
  '/update',
  requireAuth,
  requireRole('driver'),
  validate(trackingUpdateSchema),
  updateTracking
);

// GET /api/tracking/:assignmentId — get tracking history
router.get('/:assignmentId', requireAuth, getTrackingHistory);

export default router;
