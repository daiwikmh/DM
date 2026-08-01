import { db, shares, items } from '@prava/db';
import { asc, eq } from 'drizzle-orm';
import { resolve } from './resolve.ts';
import { acquireMedia } from './media.ts';

const IDLE_POLL_MS = 3000;

type Share = typeof shares.$inferSelect;

/**
 * Take the oldest queued share and mark it in-flight. A crash mid-resolve
 * leaves the row stuck in 'resolving' rather than silently re-running an
 * LLM call and a paid search on every restart.
 */
async function claimNext(): Promise<Share | undefined> {
  const [next] = await db
    .select()
    .from(shares)
    .where(eq(shares.status, 'queued'))
    .orderBy(asc(shares.createdAt))
    .limit(1);

  if (!next) return undefined;

  await db.update(shares).set({ status: 'resolving' }).where(eq(shares.id, next.id));
  return next;
}

async function processShare(share: Share): Promise<void> {
  try {
    const media = await acquireMedia(share);
    const result = await resolve(media);

    if (result.candidates.length) {
      await db.insert(items).values(
        result.candidates.map((candidate, rank) => ({
          shareId: share.id,
          rank,
          tier: 'deeplink' as const,
          title: candidate.title,
          merchant: candidate.merchant,
          merchantDomain: candidate.merchantDomain,
          priceAmount: candidate.priceAmount,
          currency: candidate.currency,
          imageUrl: candidate.imageUrl,
          productUrl: candidate.productUrl,
          catalogProductId: candidate.productId,
        })),
      );
    }

    await db
      .update(shares)
      .set({ status: 'resolved', resolution: result.resolution, resolvedAt: new Date() })
      .where(eq(shares.id, share.id));

    console.log(
      `resolver: ${share.id} → ${result.resolution}, ${result.candidates.length} item(s)`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(shares).set({ status: 'failed', error: message }).where(eq(shares.id, share.id));
    console.error(`resolver: ${share.id} failed — ${message}`);
  }
}

export function startResolverLoop(): void {
  const tick = async (): Promise<void> => {
    let worked = false;

    try {
      const share = await claimNext();
      if (share) {
        worked = true;
        await processShare(share);
      }
    } catch (err) {
      console.error('resolver: loop error', err);
    }

    // Drain a backlog without waiting a full poll between each share.
    setTimeout(tick, worked ? 0 : IDLE_POLL_MS);
  };

  console.log('resolver loop started');
  void tick();
}
