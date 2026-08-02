import type { APIRoute } from 'astro';
import { db, shares } from '@prava/db';
import { and, eq } from 'drizzle-orm';

/**
 * Delete one of your own finds.
 *
 * Ownership is part of the WHERE rather than a separate lookup, so another
 * user's share id simply matches nothing and comes back as 404.
 *
 * items cascade from shares, and checkouts cascade from items, so this also
 * discards the find's matches and any checkout rows against them.
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.userId) return new Response('Unauthorized', { status: 401 });

  const { shareId } = params;
  if (!shareId) return new Response('Missing share id', { status: 400 });

  const deleted = await db
    .delete(shares)
    .where(and(eq(shares.id, shareId), eq(shares.userId, locals.userId)))
    .returning({ id: shares.id });

  if (!deleted.length) return new Response('Not found', { status: 404 });

  return Response.json({ ok: true });
};
