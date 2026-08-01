import type { NormalizedShare } from './types.ts';
import { canonicalize, extractUrls } from './extract-url.ts';

interface IgAttachment {
  type?: string;
  payload?: { url?: string; title?: string; reel_video_id?: string };
}

interface IgMessaging {
  sender?: { id?: string };
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: IgAttachment[];
  };
}

interface IgPayload {
  object?: string;
  entry?: Array<{ messaging?: IgMessaging[] }>;
}

/** Attachment types that carry a shareable media URL. */
const SHAREABLE = new Set(['ig_reel', 'reel', 'share']);

export function parseInstagram(body: unknown): NormalizedShare[] {
  const payload = body as IgPayload;
  const shares: NormalizedShare[] = [];

  for (const entry of payload.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const message = event.message;
      const senderId = event.sender?.id;

      // Echoes are our own outbound replies coming back to us.
      if (!message || !senderId || message.is_echo) continue;

      const messageId = message.mid;
      if (!messageId) continue;

      const seen = new Set<string>();

      for (const attachment of message.attachments ?? []) {
        if (!SHAREABLE.has(attachment.type ?? '')) continue;
        const url = attachment.payload?.url;
        if (!url) continue;

        const sourceUrl = canonicalize(url);
        if (seen.has(sourceUrl)) continue;
        seen.add(sourceUrl);

        shares.push({
          platform: 'instagram',
          externalId: senderId,
          sourceUrl,
          messageId,
          title: attachment.payload?.title,
          raw: event,
        });
      }

      // Users also paste links instead of using the share sheet.
      for (const url of extractUrls(message.text)) {
        if (seen.has(url)) continue;
        seen.add(url);

        shares.push({
          platform: 'instagram',
          externalId: senderId,
          sourceUrl: url,
          messageId,
          raw: event,
        });
      }
    }
  }

  return shares;
}
