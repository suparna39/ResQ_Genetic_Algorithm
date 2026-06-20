import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  getAllAmbulances,
  getAvailableAmbulances,
  updateAmbulanceStatus,
  updateDriverLocation,
  getMyAmbulance,
} from './ambulance.controller';
import { z } from 'zod';

const router = Router();

const updateStatusSchema = z.object({
  status: z.enum(['available', 'busy', 'offline']),
});

const locationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  assignment_id: z.string().uuid().optional(),
});

// GET /api/ambulance/all — admin/driver
router.get('/all', requireAuth, requireRole('admin', 'driver'), getAllAmbulances);

// GET /api/ambulance/available — admin/dispatcher
router.get('/available', requireAuth, requireRole('admin'), getAvailableAmbulances);

// GET /api/ambulance/mine — driver gets their ambulance
router.get('/mine', requireAuth, requireRole('driver'), getMyAmbulance);

// PATCH /api/ambulance/status/:id — admin changes status
router.patch(
  '/status/:id',
  requireAuth,
  requireRole('admin'),
  validate(updateStatusSchema),
  updateAmbulanceStatus
);

// POST /api/ambulance/location — driver sends GPS update
router.post(
  '/location',
  requireAuth,
  requireRole('driver'),
  validate(locationUpdateSchema),
  updateDriverLocation
);

export default router;
