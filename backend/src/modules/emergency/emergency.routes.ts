import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createEmergency,
  getEmergencyById,
  getAssignmentForRequest,
  getAllEmergencies,
  getMyEmergencies,
  updateEmergencyStatus,
} from './emergency.controller';
import { z } from 'zod';

const router = Router();

const createEmergencySchema = z.object({
  emergency_type: z.enum([
    'cardiac_arrest',
    'accident',
    'stroke',
    'respiratory',
    'trauma',
    'fire',
    'drowning',
    'other',
  ]),
  description: z.string().min(5).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const updateStatusSchema = z.object({
  status: z.enum([
    'pending',
    'assigned',
    'accepted',
    'en_route',
    'picked_up',
    'completed',
    'cancelled',
  ]),
  priority: z
    .enum(['low', 'medium', 'high', 'critical'])
    .optional(),
});

// POST /api/emergency/create — patient creates request
router.post(
  '/create',
  requireAuth,
  requireRole('patient'),
  validate(createEmergencySchema),
  createEmergency
);

// GET /api/emergency/my — patient sees their own requests
router.get('/my', requireAuth, requireRole('patient'), getMyEmergencies);

// GET /api/emergency/all — admin sees all requests
router.get('/all', requireAuth, requireRole('admin'), getAllEmergencies);

// GET /api/emergency/:id — get single request (patient/driver/admin)
router.get('/:id', requireAuth, getEmergencyById);

// GET /api/emergency/:id/assignment — get the assignment for a request (real-time status for patient)
router.get('/:id/assignment', requireAuth, getAssignmentForRequest);

// PATCH /api/emergency/:id/status — admin updates status
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('admin'),
  validate(updateStatusSchema),
  updateEmergencyStatus
);

export default router;
