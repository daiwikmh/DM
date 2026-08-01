import { db, users, identities, shares } from '@prava/db';
import { and, eq } from 'drizzle-orm';
import type { NormalizedShare, IntakePlatform } from './types.ts';

/**
 * Map a platform handle to a user, creating one if this is a first contact.
 *
 * Instagram senders arrive as an IGSID with no phone number attached, so a
 * first-contact IG user is created with no contact details. Binding that to a
 * real account is a separate one-time link step; until then the shares still
 * accumulate against a stable user row rather than being dropped.
 */
export async function resolveUserId(
  platform: IntakePlatform,
  externalId: string,
): Promise<string> {
  const existing = await db
    .select({ userId: identities.userId })
    .from(identities)
    .where(and(eq(identities.platform, platform), eq(identities.externalId, externalId)))
    .limit(1);

  if (existing[0]) return existing[0].userId;

  const [user] = await db
    .insert(users)
    .values({ phone: platform === 'whatsapp' ? externalId : null })
    .returning({ id: users.id });

  await db
    .insert(identities)
    .values({ userId: user.id, platform, externalId })
    .onConflictDoNothing();

  // A concurrent delivery from the same new sender may have won the insert.
  const settled = await db
    .select({ userId: identities.userId })
    .from(identities)
    .where(and(eq(identities.platform, platform), eq(identities.externalId, externalId)))
    .limit(1);

  return settled[0]?.userId ?? user.id;
}

/** Returns the number of shares actually queued (duplicates are skipped). */
export async function recordShares(list: NormalizedShare[]): Promise<number> {
  let queued = 0;

  for (const share of list) {
    const userId = await resolveUserId(share.platform, share.externalId);

    const inserted = await db
      .insert(shares)
      .values({
        userId,
        platform: share.platform,
        sourceUrl: share.sourceUrl,
        messageId: share.messageId,
        rawPayload: share.raw as object,
        status: 'queued',
      })
      .onConflictDoNothing()
      .returning({ id: shares.id });

    if (inserted.length) queued += 1;
  }

  return queued;
}
