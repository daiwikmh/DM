import type { APIRoute } from 'astro';
import { buildAuthorizeUrl } from '@prava/worker/prava-mcp/oauth';

/**
 * Start the Prava MCP connection.
 *
 * The PKCE verifier is parked in an httpOnly cookie rather than a store: it is
 * single-use, short-lived, and only ever needs to survive the round trip back
 * to /prava/callback.
 */
export const GET: APIRoute = async ({ locals, cookies, redirect }) => {
  if (!locals.userId) return redirect('/');

  const { url, codeVerifier, state } = await buildAuthorizeUrl();

  const options = { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 600 } as const;
  cookies.set('prava_pkce', codeVerifier, options);
  cookies.set('prava_state', state, options);

  return redirect(url);
};
