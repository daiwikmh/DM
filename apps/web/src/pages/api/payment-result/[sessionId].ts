import type { APIRoute } from 'astro';
import { getPaymentResult, PravaError } from '@prava/worker/payments/prava';

/**
 * Polled by the checkout page while the user authorizes in the Prava iframe.
 *
 * Auth is only "is anyone signed in": sessions are not persisted locally, so
 * there is no record tying a Prava session id to a user to check against. Add
 * that check once checkouts are stored.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.userId) return new Response('Unauthorized', { status: 401 });

  const { sessionId } = params;
  if (!sessionId) return new Response('Missing session id', { status: 400 });

  try {
    const result = await getPaymentResult(sessionId);
    return Response.json(result);
  } catch (err) {
    const status = err instanceof PravaError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ status: 'failed', error: { code: 'proxy', message } }, { status });
  }
};
