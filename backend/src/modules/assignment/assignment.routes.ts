import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  getAssignmentById,
  getAllAssignments,
  getMyAssignments,
  acceptAssignment,
  pickupAssignment,
  completeAssignment,
} from './assignment.controller';

const router = Router();

// GET /api/assignment/mine — driver gets their own active assignments
router.get('/mine', requireAuth, requireRole('driver'), getMyAssignments);

// GET /api/assignment/all — admin only
router.get('/all', requireAuth, requireRole('admin'), getAllAssignments);

// GET /api/assignment/:id — any authenticated user
router.get('/:id', requireAuth, getAssignmentById);

// PATCH /api/assignment/:id/accept — driver accepts
router.patch('/:id/accept', requireAuth, requireRole('driver'), acceptAssignment);

// PATCH /api/assignment/:id/pickup — driver marks patient picked up
router.patch('/:id/pickup', requireAuth, requireRole('driver'), pickupAssignment);

// PATCH /api/assignment/:id/complete — driver marks complete
router.patch('/:id/complete', requireAuth, requireRole('driver'), completeAssignment);

export default router;
