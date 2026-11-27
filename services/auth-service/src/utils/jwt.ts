import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import type { JwtPayload, UserRole } from '@ornate/types';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'ornate_super_secret_jwt_access_key_2026_xyz123';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'ornate_super_secret_jwt_refresh_key_2026_xyz123';
const ACCESS_EXPIRY = (process.env.JWT_ACCESS_EXPIRY ?? '7d') as jwt.SignOptions['expiresIn'];
const REFRESH_EXPIRY = (process.env.JWT_REFRESH_EXPIRY ?? '30d') as jwt.SignOptions['expiresIn'];

const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getCookieOptions(req?: Request): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'none' | 'lax';
  path: string;
  domain?: string;
} {
  const isProdOrHttps =
    process.env.COOKIE_SECURE === 'true' ||
    process.env.VERCEL === '1' ||
    process.env.NODE_ENV === 'production' ||
    Boolean(req?.secure) ||
    req?.headers['x-forwarded-proto'] === 'https';

  const opts: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'none' | 'lax';
    path: string;
    domain?: string;
  } = {
    httpOnly: true,
    secure: isProdOrHttps,
    sameSite: isProdOrHttps ? 'none' : 'lax',
    path: '/api/v1',
  };

  if (process.env.COOKIE_DOMAIN && process.env.COOKIE_DOMAIN !== 'localhost') {
    opts.domain = process.env.COOKIE_DOMAIN;
  }
  return opts;
}

export function setRefreshCookie(
  res: Response,
  token: string,
  cookieName: string = 'refreshToken',
  req?: Request,
): void {
  const opts = getCookieOptions(req);
  res.cookie(cookieName, token, {
    ...opts,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

export function clearRefreshCookie(res: Response, specificCookieName?: string, req?: Request): void {
  const opts = getCookieOptions(req);
  const names = specificCookieName
    ? [specificCookieName]
    : ['refreshToken', 'customerRefreshToken', 'adminRefreshToken', 'sellerRefreshToken', 'deliveryRefreshToken'];

  for (const name of names) {
    res.clearCookie(name, opts);
    if (opts.domain) {
      const { domain: _d, ...noDomainOpts } = opts;
      res.clearCookie(name, noDomainOpts);
    }
    res.clearCookie(name, { ...opts, path: '/api/v1/auth' });
  }
}

export function extractRefreshToken(req: Request, preferredCookieNames: string[]): string | undefined {
  for (const name of preferredCookieNames) {
    const val = req.cookies?.[name];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  const bodyToken = req.body?.refreshToken;
  if (typeof bodyToken === 'string' && bodyToken.trim()) return bodyToken.trim();
  const headerToken = req.headers['x-refresh-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) return headerToken.trim();
  return undefined;
}

export function signAccessToken(payload: {
  userId: string;
  email: string;
  role: UserRole;
  sellerId?: string;
  storeId?: string;
  deliveryPartnerId?: string;
  categoryId?: string;
  subcategoryId?: string;
}): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
}

export function signRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): { userId: string; iat: number; exp: number } {
  return jwt.verify(token, REFRESH_SECRET) as { userId: string; iat: number; exp: number };
}
