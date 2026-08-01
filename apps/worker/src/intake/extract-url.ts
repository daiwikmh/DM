/**
 * Hosts we can attempt to resolve. Anything else in a message is ignored so a
 * user pasting an unrelated link doesn't create a share that can never resolve.
 */
const SUPPORTED = [
  /^(?:www\.)?instagram\.com$/i,
  /^(?:www\.)?tiktok\.com$/i,
  /^vm\.tiktok\.com$/i,
  /^(?:www\.)?pinterest\.[a-z.]+$/i,
  /^pin\.it$/i,
  /^(?:www\.)?youtube\.com$/i,
  /^youtu\.be$/i,
];

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

function isSupported(raw: string): boolean {
  try {
    return SUPPORTED.some((host) => host.test(new URL(raw).hostname));
  } catch {
    return false;
  }
}

/** Strip tracking params so the same reel shared twice dedupes to one URL. */
export function canonicalize(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (key === 'igsh' || key === 'igshid' || key.startsWith('utm_')) {
        url.searchParams.delete(key);
      }
    }
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}

/**
 * Pull shareable media URLs out of free text. WhatsApp delivers a shared reel
 * as a plain text body rather than an attachment, so this is the primary path
 * there and a secondary one on Instagram (users paste links too).
 */
export function extractUrls(text: string | undefined | null): string[] {
  if (!text) return [];

  const found = text.match(URL_PATTERN) ?? [];
  const cleaned = found
    .map((url) => url.replace(/[.,;:)\]]+$/, ''))
    .filter(isSupported)
    .map(canonicalize);

  return [...new Set(cleaned)];
}
