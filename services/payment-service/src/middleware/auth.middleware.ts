import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload, UserRole } from '@ornate/types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'ornate_super_secret_jwt_access_key_2026_xyz123';

export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      req.user = jwt.verify(token, ACCESS_SECRET) as JwtPayload;
    } catch {
      // ignore
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    return;
  }
  next();
}

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
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
      return;
    }
    const userLevel = ROLE_HIERARCHY[req.user.role] ?? -1;
    const hasPermission = roles.some((role) => userLevel >= ROLE_HIERARCHY[role]);
    if (!hasPermission) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions.' } });
      return;
    }
    next();
  };
}
