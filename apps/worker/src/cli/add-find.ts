import { db, users, shares, items, identities } from '@prava/db';
import { and, eq } from 'drizzle-orm';

interface ShopifyVariant {
  id: number;
  price: number;
  available: boolean;
  title: string;
}

interface ShopifyProduct {
  title: string;
  vendor: string;
  featured_image?: string | null;
  images?: string[];
  variants?: ShopifyVariant[];
}

async function findUser(who: string) {
  const [byEmail] = await db.select().from(users).where(eq(users.email, who)).limit(1);
  if (byEmail) return byEmail;

  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.platform, 'instagram'), eq(identities.externalId, who)))
    .limit(1);

  if (identity) {
    const [u] = await db.select().from(users).where(eq(users.id, identity.userId)).limit(1);
    if (u) return u;
  }
  return null;
}

async function shopCurrency(origin: string): Promise<string | null> {
  const res = await fetch(`${origin}/cart.js`, {
    headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' },
  }).catch(() => null);

  if (!res?.ok) return null;
  const cart = (await res.json().catch(() => null)) as { currency?: string } | null;
  return cart?.currency ?? null;
}

async function fetchProduct(productUrl: string) {
  const canonical = productUrl.split('?')[0].replace(/\/$/, '');
  const res = await fetch(`${canonical}.js`, {
    headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' },
  });

  if (!res.ok) return null;

  const product = (await res.json().catch(() => null)) as ShopifyProduct | null;
  if (!product?.variants?.length) return null;

  return { canonical, product };
}

async function main() {
  const [who, productUrl, currencyArg] = process.argv.slice(2).filter((a) => a !== '--');

  if (!who || !productUrl) {
    console.error('Usage: pnpm add-find -- <email|instagram-igsid> <shopify-product-url> [currency]');
    process.exit(1);
  }

  const user = await findUser(who);
  if (!user) {
    console.error(`No user matching "${who}". Sign in once first.`);
    process.exit(1);
  }

  const fetched = await fetchProduct(productUrl);
  if (!fetched) {
    console.error('Not a Shopify storefront (no product JSON) — checkout automation only drives Shopify.');
    process.exit(1);
  }

  const { canonical, product } = fetched;
  const variant = product.variants!.find((v) => v.available) ?? product.variants![0];

  if (!variant.available) {
    console.error(`Every variant of "${product.title}" is sold out.`);
    process.exit(1);
  }

  const origin = new URL(canonical).origin;
  const detected = await shopCurrency(origin);
  const currency = currencyArg ?? detected ?? 'USD';
  const price = (variant.price / 100).toFixed(2);

  if (detected && detected !== 'USD' && !currencyArg) {
    console.warn(
      `\n!! This store served ${detected}, not USD — Shopify prices by IP and yours is not US.`,
    );
    console.warn(`   Stored as ${detected} ${price}. The deployed worker will see USD prices.`);
    console.warn(`   Pass a currency argument to override.\n`);
  }

  const [share] = await db
    .insert(shares)
    .values({
      userId: user.id,
      platform: 'share_target',
      sourceUrl: canonical,
      status: 'resolved',
      resolution: 'exact',
      resolvedAt: new Date(),
    })
    .returning();

  await db.insert(items).values({
    shareId: share.id,
    rank: 0,
    tier: 'buyable',
    title: product.title,
    merchant: product.vendor || new URL(origin).hostname.replace(/^www\./, ''),
    merchantDomain: new URL(origin).hostname.replace(/^www\./, ''),
    priceAmount: price,
    currency,
    imageUrl: product.featured_image ?? product.images?.[0] ?? null,
    productUrl: `${canonical}?variant=${variant.id}&country=US&currency=USD`,
    catalogProductId: String(variant.id),
  });

  console.log(`added: ${product.title}`);
  console.log(`  merchant: ${product.vendor}`);
  console.log(`  variant:  ${variant.title} (${variant.id})`);
  console.log(`  price:    ${price} ${currency}`);
  console.log(`  for:      ${user.email}`);
  console.log(`\nit will appear in Finds immediately.`);
  process.exit(0);
}

void main();
