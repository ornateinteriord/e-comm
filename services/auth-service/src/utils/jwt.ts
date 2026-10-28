import jwt from 'jsonwebtoken';
import type { JwtPayload, UserRole } from '@ornate/types';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'ornate_super_secret_jwt_access_key_2026_xyz123';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'ornate_super_secret_jwt_refresh_key_2026_xyz123';
const ACCESS_EXPIRY = (process.env.JWT_ACCESS_EXPIRY ?? '15m') as jwt.SignOptions['expiresIn'];
const REFRESH_EXPIRY = (process.env.JWT_REFRESH_EXPIRY ?? '7d') as jwt.SignOptions['expiresIn'];

export function signAccessToken(payload: { userId: string; email: string; role: UserRole }): string {
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
