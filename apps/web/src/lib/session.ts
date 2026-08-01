import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';

const COOKIE = 'prava_session';
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days

function secret(): string {
  const s = import.meta.env.SESSION_SECRET ?? process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

/**
 * Cookie is `<userId>.<hmac>`. There is no server-side session store — the
 * signature is the only thing preventing forgery, so SESSION_SECRET rotating
 * logs everyone out. That is the intended tradeoff at this size.
 */
export function setSession(cookies: AstroCookies, userId: string): void {
  cookies.set(COOKIE, `${userId}.${sign(userId)}`, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    maxAge: MAX_AGE,
  });
}

export function clearSession(cookies: AstroCookies): void {
  cookies.delete(COOKIE, { path: '/' });
}

export function readSession(cookies: AstroCookies): string | null {
  const raw = cookies.get(COOKIE)?.value;
  if (!raw) return null;

  const separator = raw.lastIndexOf('.');
  if (separator < 1) return null;

  const userId = raw.slice(0, separator);
  const provided = Buffer.from(raw.slice(separator + 1));
  const expected = Buffer.from(sign(userId));

  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? userId : null;
}
