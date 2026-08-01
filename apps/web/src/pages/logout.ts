import type { APIRoute } from 'astro';
import { clearSession } from '../lib/session.ts';

export const GET: APIRoute = ({ cookies, redirect }) => {
  clearSession(cookies);
  return redirect('/');
};
