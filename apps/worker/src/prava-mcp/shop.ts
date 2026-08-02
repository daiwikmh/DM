import { db, pravaConnections } from '@prava/db';
import { eq } from 'drizzle-orm';
import { callTool } from './client.ts';
import { refresh, type TokenSet } from './oauth.ts';

export interface ShopOffer {
  productId?: string;
  variantId?: string;
  merchant?: string;
  title?: string;
  price?: string;
  currency?: string;
  image?: string;
  [key: string]: unknown;
}

export async function saveConnection(userId: string, tokens: TokenSet, scope: string): Promise<void> {
  await db
    .insert(pravaConnections)
    .values({
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope,
    })
    .onConflictDoUpdate({
      target: pravaConnections.userId,
      set: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope,
      },
    });
}

export async function isConnected(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: pravaConnections.userId })
    .from(pravaConnections)
    .where(eq(pravaConnections.userId, userId))
    .limit(1);

  return Boolean(row);
}

/**
 * A usable access token, refreshed on the way out if it has expired.
 * Returns null when the user has never connected — the caller turns that into
 * a "Connect Prava" prompt rather than an error.
 */
export async function accessTokenFor(userId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(pravaConnections)
    .where(eq(pravaConnections.userId, userId))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt > new Date()) return row.accessToken;
  if (!row.refreshToken) return null;

  const tokens = await refresh(row.refreshToken);
  await saveConnection(userId, tokens, row.scope ?? '');
  return tokens.accessToken;
}

async function call<T>(userId: string, tool: string, args: Record<string, unknown>): Promise<T> {
  const token = await accessTokenFor(userId);
  if (!token) throw new Error('NOT_CONNECTED');

  return callTool<T>(token, tool, args);
}

/** Discovery across UCP-participating Shopify merchants. */
export function shopSearch(
  userId: string,
  query: string,
  opts: { intent?: string; limit?: number; merchant?: string; shipsTo?: string } = {},
): Promise<unknown> {
  return call(userId, 'shop_search', {
    query,
    ...(opts.intent ? { intent: opts.intent } : {}),
    ...(opts.limit ? { limit: opts.limit } : {}),
    ...(opts.merchant ? { merchant: opts.merchant } : {}),
    ...(opts.shipsTo ? { ships_to: opts.shipsTo } : {}),
  });
}

export function shopProduct(userId: string, productId: string, merchant?: string): Promise<unknown> {
  return call(userId, 'shop_product', {
    product_id: productId,
    ...(merchant ? { merchant } : {}),
  });
}

/** Opens a checkout and locks a binding total. Needs an address on file. */
export function shopQuote(
  userId: string,
  variantId: string,
  merchant: string,
  opts: { quantity?: number; addressId?: string } = {},
): Promise<unknown> {
  return call(userId, 'shop_quote', {
    variant_id: variantId,
    merchant,
    ...(opts.quantity ? { quantity: opts.quantity } : {}),
    ...(opts.addressId ? { address_id: opts.addressId } : {}),
  });
}

/** Charges nothing by itself — returns a payment_url for the user to approve. */
export function createPaymentSession(
  userId: string,
  totalAmount: string,
  currency: string,
  merchant: { name: string; url?: string },
): Promise<unknown> {
  return call(userId, 'create_payment_session', {
    total_amount: totalAmount,
    currency,
    merchant_name: merchant.name,
    ...(merchant.url ? { merchant_url: merchant.url } : {}),
  });
}

export function getPaymentStatus(userId: string, paymentSessionId: string): Promise<unknown> {
  return call(userId, 'get_payment_status', { payment_session_id: paymentSessionId });
}

/** The only call that spends money. */
export function shopCheckout(
  userId: string,
  checkoutSessionId: string,
  paymentSessionId: string,
): Promise<unknown> {
  return call(userId, 'shop_checkout', {
    checkout_session_id: checkoutSessionId,
    payment_session_id: paymentSessionId,
  });
}

export function listAddresses(userId: string): Promise<unknown> {
  return call(userId, 'shop_list_addresses', {});
}

export function ping(userId: string): Promise<unknown> {
  return call(userId, 'ping', {});
}
