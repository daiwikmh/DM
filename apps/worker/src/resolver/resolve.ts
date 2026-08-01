import { identify, type ProductSignal } from './identify.ts';
import type { CatalogCandidate } from './catalog.ts';
import { searchByText } from './serpapi.ts';

export interface ResolveResult {
  signal: ProductSignal;
  candidates: CatalogCandidate[];
  /** Drives which tier of dashboard card renders — see @prava/db's `resolution` enum. */
  resolution: 'exact' | 'similar' | 'none';
}

/**
 * identify() → Google Shopping text search. Deliberately text-only: the
 * search_query identify() produces is already built to stand on its own as a
 * shopping-engine query. Catalog MCP (catalog.ts) is the intended backend but
 * needs client credentials we don't have; serpapi.ts returns the same shape.
 */
export async function resolve(params: {
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  caption?: string;
}): Promise<ResolveResult> {
  const signal = await identify(params);
  let candidates = await searchByText(signal.searchQuery);

  // A very specific query can match nothing at all. Retry once on the coarse
  // description before giving up — a 'similar' match beats an empty card, and
  // this only costs a call when the precise query already failed.
  if (candidates.length === 0) {
    const coarse = [signal.brand, signal.color, signal.productType].filter(Boolean).join(' ');
    if (coarse && coarse !== signal.searchQuery) {
      candidates = await searchByText(coarse);
    }
  }

  const resolution: ResolveResult['resolution'] =
    candidates.length === 0 ? 'none' : signal.confidence === 'high' && signal.brand ? 'exact' : 'similar';

  return { signal, candidates, resolution };
}
