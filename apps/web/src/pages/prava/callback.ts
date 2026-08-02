import type { APIRoute } from 'astro';
import { exchangeCode, SCOPES } from '@prava/worker/prava-mcp/oauth';
import { saveConnection } from '@prava/worker/prava-mcp/shop';

export const GET: APIRoute = async ({ locals, url, cookies, redirect }) => {
  if (!locals.userId) return redirect('/');

  const error = url.searchParams.get('error');
  if (error) {
    return new Response(`Prava refused the connection: ${error}`, { status: 400 });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const verifier = cookies.get('prava_pkce')?.value;
  const expectedState = cookies.get('prava_state')?.value;

  if (!code || !verifier) return new Response('Missing code or PKCE verifier', { status: 400 });

  // Guards against a callback forged by another site.
  if (!state || state !== expectedState) return new Response('State mismatch', { status: 400 });

  const tokens = await exchangeCode(code, verifier);
  await saveConnection(locals.userId, tokens, SCOPES);

  cookies.delete('prava_pkce', { path: '/' });
  cookies.delete('prava_state', { path: '/' });

  return redirect('/dashboard');
};
