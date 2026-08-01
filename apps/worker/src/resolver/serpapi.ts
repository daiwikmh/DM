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
  product_link?: string;
  immersive_product_page_token?: string;
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

/**
 * Google Shopping only ever hands back its own redirect page, and the
 * google_product engine that used to expose sellers is discontinued. The
 * immersive-product endpoint is the remaining route to a real merchant URL —
 * which checkout needs, since nothing can be bought on google.com/search.
 * Costs one extra API call per candidate, so keep result counts small.
 */
async function merchantUrl(token: string | undefined, apiKey: string): Promise<string | null> {
  if (!token) return null;

  try {
    const params = new URLSearchParams({
      engine: 'google_immersive_product',
      page_token: token,
      api_key: apiKey,
    });
    const res = await fetch(`${SERPAPI_URL}?${params}`);
    if (!res.ok) return null;

    const body = (await res.json()) as {
      product_results?: { stores?: Array<{ link?: string }> };
    };

    return body.product_results?.stores?.find((s) => s.link)?.link ?? null;
  } catch {
    return null;
  }
}

async function toCandidates(
  results: ShoppingResult[],
  apiKey: string,
): Promise<CatalogCandidate[]> {
  const resolved = await Promise.all(
    results.map(async (r) => {
      if (!r.title) return null;

      const direct = await merchantUrl(r.immersive_product_page_token, apiKey);
      const productUrl = direct ?? r.product_link;
      if (!productUrl) return null;

      return {
        productId: r.product_id ?? productUrl,
        title: r.title,
        merchant: r.source ?? null,
        merchantDomain: domainOf(direct ?? undefined),
        priceAmount: r.extracted_price != null ? r.extracted_price.toFixed(2) : null,
        currency: currencyOf(r.price),
        imageUrl: r.thumbnail ?? null,
        productUrl,
      };
    }),
  );

  return resolved.filter((c): c is CatalogCandidate => c !== null);
}

/**
 * Product search across the open web, standing in for Shopify Catalog MCP.
 * Returns the same CatalogCandidate shape so the resolver and `items` mapping
 * are unchanged if Catalog credentials arrive later.
 */
export async function searchByText(query: string, limit = 3): Promise<CatalogCandidate[]> {
  const apiKey = requireEnv('SERPAPI_API_KEY');

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    gl: REGION,
    hl: 'en',
    api_key: apiKey,
  });

  const res = await fetch(`${SERPAPI_URL}?${params}`);
  if (!res.ok) {
    throw new Error(`serpapi search failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  const body = (await res.json()) as { shopping_results?: ShoppingResult[]; error?: string };

  // SerpAPI reports an empty result set as an error. A query that matched
  // nothing is a legitimate outcome — it resolves as 'none', not as a failure.
  if (body.error) {
    if (/hasn't returned any results|no results/i.test(body.error)) return [];
    throw new Error(`serpapi: ${body.error}`);
  }

  return toCandidates((body.shopping_results ?? []).slice(0, limit), apiKey);
}
