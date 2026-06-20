import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { AppError } from './errorHandler';
import { UserRole } from '../types';

// Extend Express Request to carry the session user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: UserRole;
      };
    }
  }
}

// Direct DB pool — same SSL config as auth.config.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Extract the session token from:
 * 1. Cookie: better-auth.session_token=<token>
 * 2. Authorization: Bearer <token>
 */
function extractToken(req: Request): string | null {
  // Check Authorization header first
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check cookie
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)better-auth\.session_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
}

/**
 * Validate session token against DB and attach user to req.user
 * Works regardless of how Better Auth stores sessions.
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new AppError('Unauthorized — please log in', 401);
    }

    // Look up session + user in a single query
    const { rows } = await pool.query<{
      user_id: string;
      expires_at: Date;
      name: string;
      email: string;
      role: string;
    }>(
      `SELECT s."userId" AS user_id, s."expiresAt" AS expires_at,
              u.name, u.email, u.role
       FROM session s
       JOIN "user" u ON u.id = s."userId"
       WHERE s.token = $1`,
      [token]
    );

    if (rows.length === 0) {
      throw new AppError('Unauthorized — session not found', 401);
    }

    const row = rows[0];

    // Check expiry
    if (new Date(row.expires_at) < new Date()) {
      throw new AppError('Unauthorized — session expired', 401);
    }

    req.user = {
      id: row.user_id,
      email: row.email,
      name: row.name,
      role: (row.role as UserRole) || 'patient',
    };

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Restrict route to specific roles
 */
export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Unauthorized', 401));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError('Forbidden — insufficient permissions', 403));
      return;
    }
    next();
  };
