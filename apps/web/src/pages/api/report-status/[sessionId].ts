import type { APIRoute } from 'astro';
import { db, checkouts } from '@prava/db';
import { and, eq } from 'drizzle-orm';
import { reportStatus, PravaError } from '@prava/worker/payments/prava';

/**
 * Manual fallback for when the executor never reaches a gateway verdict.
 *
 * This is the user's own attestation, not an authoritative outcome, so it is
 * deliberately secondary to /api/place-order.
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.userId) return new Response('Unauthorized', { status: 401 });

  const { sessionId } = params;
  if (!sessionId) return new Response('Missing session id', { status: 400 });

  const body = (await request.json().catch(() => null)) as {
    status?: 'APPROVED' | 'DECLINED';
  } | null;

  if (body?.status !== 'APPROVED' && body?.status !== 'DECLINED') {
    return new Response('status must be APPROVED or DECLINED', { status: 400 });
  }

  const [checkout] = await db
    .select()
    .from(checkouts)
    .where(and(eq(checkouts.sessionId, sessionId), eq(checkouts.userId, locals.userId)))
    .limit(1);

  if (!checkout) return new Response('Not found', { status: 404 });
  if (!checkout.txnRefId) return new Response('Card not minted yet', { status: 409 });

  try {
    await reportStatus({ sessionId, txnRefId: checkout.txnRefId, status: body.status });

    await db
      .update(checkouts)
      .set({
        status: body.status === 'APPROVED' ? 'placed' : 'declined',
        outcome: 'reported manually by the user',
        settledAt: new Date(),
      })
      .where(eq(checkouts.id, checkout.id));

    return Response.json({ ok: true });
  } catch (err) {
    const status = err instanceof PravaError ? err.status : 500;
    return Response.json(
      { ok: false, message: err instanceof Error ? err.message : String(err) },
      { status },
    );
  }
};
