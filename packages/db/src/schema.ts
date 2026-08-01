import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const platform = pgEnum('platform', ['instagram', 'whatsapp', 'share_target']);

export const shareStatus = pgEnum('share_status', [
  'queued',
  'resolving',
  'resolved',
  'failed',
]);

/** How well the reel resolved. Drives which tier of UI the share renders as. */
export const resolution = pgEnum('resolution', ['exact', 'similar', 'none']);

/** What the user can actually do with an item. */
export const itemTier = pgEnum('item_tier', ['buyable', 'deeplink']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').unique(),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per platform handle. Instagram senders arrive as an IGSID that has no
 * relation to a phone number, so binding it to a user is a one-time link step.
 */
export const identities = pgTable(
  'identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: platform('platform').notNull(),
    externalId: text('external_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('identities_platform_external_id').on(t.platform, t.externalId)],
);

export const shares = pgTable(
  'shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: platform('platform').notNull(),
    sourceUrl: text('source_url').notNull(),
    /** Platform message id. Meta retries webhook deliveries, so this is the idempotency key. */
    messageId: text('message_id'),
    /** Raw webhook payload, kept so the resolver can be re-run without re-fetching. */
    rawPayload: jsonb('raw_payload'),
    status: shareStatus('status').notNull().default('queued'),
    resolution: resolution('resolution'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('shares_user_created').on(t.userId, t.createdAt),
    index('shares_status').on(t.status),
    uniqueIndex('shares_dedupe').on(t.platform, t.messageId, t.sourceUrl),
  ],
);

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shareId: uuid('share_id')
      .notNull()
      .references(() => shares.id, { onDelete: 'cascade' }),
    /** 0 is the best candidate; the dashboard shows rank 0 and keeps the rest for fallback. */
    rank: integer('rank').notNull().default(0),
    tier: itemTier('tier').notNull(),
    title: text('title').notNull(),
    merchant: text('merchant'),
    merchantDomain: text('merchant_domain'),
    priceAmount: numeric('price_amount', { precision: 12, scale: 2 }),
    currency: text('currency'),
    imageUrl: text('image_url'),
    productUrl: text('product_url').notNull(),
    /**
     * Shopify Catalog product/variant GID when the match came from Catalog MCP.
     * Their terms forbid caching search results or images, so this is an
     * identifier for re-querying, not a cache key.
     */
    catalogProductId: text('catalog_product_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('items_share_rank').on(t.shareId, t.rank)],
);
