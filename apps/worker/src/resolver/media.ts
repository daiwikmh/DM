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

interface RawEvent {
  message?: {
    text?: string;
    attachments?: Array<{ type?: string; payload?: { url?: string } }>;
  };
}

/**
 * Pull a resolvable image out of a stored webhook payload.
 *
 * Reels are not resolvable yet: the webhook carries only a permalink and a
 * reel_video_id, and instagram.com/reel/… is not fetchable without oEmbed
 * access. Image DMs carry a direct CDN URL, so those are the ones we can
 * actually feed to identify(). Those URLs are signed and expire, which is why
 * the loop downloads on a short poll rather than lazily at render time.
 */
export async function acquireMedia(rawPayload: unknown): Promise<ShareMedia> {
  const event = rawPayload as RawEvent | null;
  const image = event?.message?.attachments?.find((a) => a.type === 'image');

  if (!image?.payload?.url) {
    throw new Error('no image attachment — reels are not resolvable yet, send a photo');
  }

  const res = await fetch(image.payload.url);
  if (!res.ok) throw new Error(`media fetch failed: ${res.status}`);

  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const mediaType = MEDIA_TYPES[contentType];
  if (!mediaType) throw new Error(`unsupported media type: ${contentType || 'unknown'}`);

  const imageBase64 = Buffer.from(await res.arrayBuffer()).toString('base64');

  return { imageBase64, mediaType, caption: event?.message?.text };
}
