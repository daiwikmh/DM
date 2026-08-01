import type { APIRoute } from 'astro';
import { db, users } from '@prava/db';
import { eq } from 'drizzle-orm';
import { setSession } from '../lib/session.ts';

/**
 * Development-only sign-in. Real auth (email OTP) is not wired yet — this
 * exists so the dashboard is reachable while Phases 1–3 are built. It refuses
 * to run outside dev.
 */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!import.meta.env.DEV) return new Response('Not found', { status: 404 });

  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  if (!email) return new Response('email required', { status: 400 });

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = existing[0] ?? (await db.insert(users).values({ email }).returning())[0];

  setSession(cookies, user.id);
  return redirect('/dashboard');
};
