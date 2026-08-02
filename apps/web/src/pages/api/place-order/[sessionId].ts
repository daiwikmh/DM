import type { APIRoute } from 'astro';
import { db, items, checkouts, users, type ShippingAddress } from '@prava/db';
import { and, eq } from 'drizzle-orm';
import { getPaymentResult, reportStatus } from '@prava/worker/payments/prava';

const EXECUTOR = process.env.CHECKOUT_EXECUTOR_URL ?? 'http://127.0.0.1:8788/execute';

interface ExecutorResult {
  status: 'placed' | 'declined' | 'failed';
  message: string;
  url?: string;
  screenshot?: string;
}

/**
 * Hand the minted card to the checkout executor, then settle with Prava.
 *
 * The card is fetched server-side from Prava rather than accepted from the
 * browser: the page never holds it, and a caller cannot substitute one. A
 * decline is a real outcome — the chain ran and the merchant's gateway
 * answered — so it settles as DECLINED rather than being treated as an error.
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.userId) return new Response('Unauthorized', { status: 401 });

  const { sessionId } = params;
  if (!sessionId) return new Response('Missing session id', { status: 400 });

  const body = (await request.json().catch(() => null)) as {
    shipping?: Record<string, string>;
  } | null;

  if (!body?.shipping) return new Response('shipping is required', { status: 400 });

  const [checkout] = await db
    .select()
    .from(checkouts)
    .where(and(eq(checkouts.sessionId, sessionId), eq(checkouts.userId, locals.userId)))
    .limit(1);

  if (!checkout) return new Response('Not found', { status: 404 });

  const [item] = await db.select().from(items).where(eq(items.id, checkout.itemId)).limit(1);
  if (!item) return new Response('Not found', { status: 404 });

  // Remembered for next time: nobody should retype their address per purchase.
  await db
    .update(users)
    .set({ shipping: body.shipping as unknown as ShippingAddress })
    .where(eq(users.id, locals.userId))
    .catch((err) => console.error('could not save shipping address', err));

  console.log(`order: ${sessionId} — fetching minted card from Prava`);
  const payment = await getPaymentResult(sessionId);
  if (!payment.credentials) {
    console.log(`order: ${sessionId} — not minted yet (${payment.status})`);
    return Response.json(
      { status: 'failed', message: `card not minted yet (${payment.status})` },
      { status: 409 },
    );
  }

  console.log(
    `order: ${sessionId} — card **** ${payment.credentials.token.slice(-4)}, handing to executor for ${item.productUrl}`,
  );

  const executorRes = await fetch(EXECUTOR, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      productUrl: item.productUrl,
      card: payment.credentials,
      shipping: body.shipping,
    }),
  }).catch(() => null);

  if (!executorRes) {
    await db
      .update(checkouts)
      .set({ status: 'failed', outcome: 'checkout executor unreachable' })
      .where(eq(checkouts.id, checkout.id));

    return Response.json(
      { status: 'failed', message: 'checkout executor unreachable — is the worker running?' },
      { status: 502 },
    );
  }

  const result = (await executorRes.json()) as ExecutorResult;
  console.log(`order: ${sessionId} — merchant said ${result.status}: ${result.message}`);

  await db
    .update(checkouts)
    .set({ status: result.status, outcome: result.message, settledAt: new Date() })
    .where(eq(checkouts.id, checkout.id));

  // Only a gateway verdict is worth settling; a driver failure never reached one.
  // No processor codes are sent: response_code is capped at 2 characters and we
  // have nothing authoritative to put in it.
  if (result.status === 'placed' || result.status === 'declined') {
    await reportStatus({
      sessionId,
      txnRefId: payment.credentials.txnRefId,
      status: result.status === 'placed' ? 'APPROVED' : 'DECLINED',
    })
      .then(() => console.log(`order: ${sessionId} — settled with Prava as ${result.status === 'placed' ? 'APPROVED' : 'DECLINED'}`))
      .catch((err) => console.error('report-status failed', err));
  }

  return Response.json(result);
};
