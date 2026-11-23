import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { UserRole } from '../src/types/kabmeet';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getAllowedRoutesForRole(role: UserRole): string[] {
  const base = ['/', '/communities'];
  if (role === 'VISITOR') return base;
  const member = [...base, '/watch', '/room', '/classes', '/profile'];
  if (role === 'HOST' || role === 'MODERATOR' || role === 'LECTURER') {
    return [...member, '/host-panel'];
  }
  if (role === 'ADMIN') {
    return [...member, '/host-panel', '/admin'];
  }
  return member;
}

export function isStaffOrHost(role: UserRole): boolean {
  return role === 'HOST' || role === 'MODERATOR' || role === 'LECTURER' || role === 'ADMIN';
}
