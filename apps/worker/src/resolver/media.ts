export interface ShareMedia {
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  caption?: string;
}

const MEDIA_TYPES: Record<string, ShareMedia['mediaType']> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

/** Instagram serves og: tags to crawlers, and only to crawlers. */
const CRAWLER_UA = 'facebookexternalhit/1.1';

const OG_IMAGE = /<meta property="og:image" content="([^"]+)"/;

interface RawEvent {
  message?: {
    text?: string;
    attachments?: Array<{ type?: string; payload?: { url?: string; title?: string } }>;
  };
}

async function download(
  url: string,
): Promise<{ imageBase64: string; mediaType: ShareMedia['mediaType'] }> {
  const res = await fetch(url, { headers: { 'user-agent': CRAWLER_UA } });
  if (!res.ok) throw new Error(`media fetch failed: ${res.status}`);

  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const mediaType = MEDIA_TYPES[contentType];
  if (!mediaType) throw new Error(`unsupported media type: ${contentType || 'unknown'}`);

  return { imageBase64: Buffer.from(await res.arrayBuffer()).toString('base64'), mediaType };
}

/**
 * Instagram's own reel page carries the keyframe as an og:image, which is
 * enough to identify the product without oEmbed access or app review. The
 * webhook itself only gives a permalink and a reel_video_id, neither of which
 * is fetchable, so this scrape is the only route to reel pixels we have.
 */
async function reelThumbnail(permalink: string): Promise<string> {
  const res = await fetch(permalink, { headers: { 'user-agent': CRAWLER_UA } });
  if (!res.ok) throw new Error(`reel page fetch failed: ${res.status}`);

  const match = OG_IMAGE.exec(await res.text());
  if (!match) throw new Error('reel page had no og:image — it may be private or removed');

  return match[1].replace(/&amp;/g, '&');
}

/**
 * Pull a resolvable image out of a share.
 *
 * Photo DMs carry a direct CDN URL in the payload. Reels carry only a
 * permalink, so their keyframe is scraped from the public page. CDN URLs are
 * signed and expire, which is why the loop downloads on a short poll rather
 * than lazily at render time.
 */
export async function acquireMedia(share: {
  rawPayload: unknown;
  sourceUrl: string;
}): Promise<ShareMedia> {
  const event = share.rawPayload as RawEvent | null;
  const attachments = event?.message?.attachments ?? [];

  const image = attachments.find((a) => a.type === 'image');
  if (image?.payload?.url) {
    return { ...(await download(image.payload.url)), caption: event?.message?.text };
  }

  if (/^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p)\//i.test(share.sourceUrl)) {
    const reel = attachments.find((a) => a.type === 'ig_reel' || a.type === 'reel');
    return {
      ...(await download(await reelThumbnail(share.sourceUrl))),
      caption: reel?.payload?.title ?? event?.message?.text,
    };
  }

  throw new Error(`no resolvable media for ${share.sourceUrl}`);
}
