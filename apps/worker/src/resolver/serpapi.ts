import type { CatalogCandidate } from './catalog.ts';

const SERPAPI_URL = 'https://serpapi.com/search.json';

/** Google Shopping is region-scoped; results and prices are meaningless without it. */
const REGION = 'in';

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  '₹': 'INR',
  $: 'USD',
  '£': 'GBP',
  '€': 'EUR',
  '¥': 'JPY',
};

interface ShoppingResult {
  position?: number;
  product_id?: string;
  title?: string;
  link?: string;
  product_link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function currencyOf(price: string | undefined): string | null {
  if (!price) return null;
  for (const [symbol, code] of Object.entries(CURRENCY_BY_SYMBOL)) {
    if (price.includes(symbol)) return code;
  }
  return null;
}

function domainOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function toCandidates(results: ShoppingResult[]): CatalogCandidate[] {
  return results.flatMap((r) => {
    const productUrl = r.product_link ?? r.link;
    if (!productUrl || !r.title) return [];

    return [
      {
        productId: r.product_id ?? productUrl,
        title: r.title,
        merchant: r.source ?? null,
        merchantDomain: domainOf(r.link),
        priceAmount: r.extracted_price != null ? r.extracted_price.toFixed(2) : null,
        currency: currencyOf(r.price),
        imageUrl: r.thumbnail ?? null,
        productUrl,
      },
    ];
  });
}

/**
 * Product search across the open web, standing in for Shopify Catalog MCP.
 * Returns the same CatalogCandidate shape so the resolver and `items` mapping
 * are unchanged if Catalog credentials arrive later.
 */
export async function searchByText(query: string, limit = 5): Promise<CatalogCandidate[]> {
  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    gl: REGION,
    hl: 'en',
    api_key: requireEnv('SERPAPI_API_KEY'),
  });

  const res = await fetch(`${SERPAPI_URL}?${params}`);
  if (!res.ok) {
    throw new Error(`serpapi search failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  const body = (await res.json()) as { shopping_results?: ShoppingResult[]; error?: string };
  if (body.error) throw new Error(`serpapi: ${body.error}`);

  return toCandidates(body.shopping_results ?? []).slice(0, limit);
}
