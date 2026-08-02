import type { APIRoute } from 'astro';
import { db, shares } from '@prava/db';
import { and, eq } from 'drizzle-orm';

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
