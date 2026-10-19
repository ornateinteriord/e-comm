import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import type { JwtPayload, UserRole } from '@ornate/types';

// Extend Express Request to carry the decoded JWT payload
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Validates the Authorization: Bearer <token> header.
 * Sets req.user if valid. Does NOT reject unauthenticated requests —
 * use requireAuth() for that.
 */
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // invalid/expired token — treat as unauthenticated
    }
  }
  next();
}

/**
 * Rejects requests that do not have a valid, authenticated user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    });
    return;
  }
  next();
}

/**
 * Enforces role-based access control.
 * Roles are ordered by privilege level.
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  customer: 0,
  support: 1,
  catalog_manager: 2,
  inventory_manager: 3,
  order_manager: 4,
  finance_manager: 5,
  admin: 6,
  super_admin: 7,
};

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
      return;
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? -1;
    const hasPermission = roles.some(
      (role) => userLevel >= ROLE_HIERARCHY[role],
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions.' },
      });
      return;
    }
    next();
  };
}
