import { Router, Request, Response, NextFunction } from 'express';
import { auth } from './auth.config';
import { toNodeHandler } from 'better-auth/node';
import { requireAuth } from '../../middleware/auth';
import { getMeController } from './auth.controller';

const router = Router();

// Better Auth handles all /api/auth/* routes automatically
router.all('/{*path}', (req: Request, res: Response, next: NextFunction) => {
  // Exclude /me from better-auth handler — handled separately
  if (req.path === '/me') return next();
  return toNodeHandler(auth)(req as any, res as any);
});

// GET /api/auth/me — get current session user with role
router.get('/me', requireAuth, getMeController);

export default router;
