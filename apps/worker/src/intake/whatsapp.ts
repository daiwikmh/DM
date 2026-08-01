import type { NormalizedShare } from './types.ts';
import { extractUrls } from './extract-url.ts';

interface WaMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  video?: { caption?: string };
  image?: { caption?: string };
}

interface WaPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{ field?: string; value?: { messages?: WaMessage[] } }>;
  }>;
}

export function parseWhatsApp(body: unknown): NormalizedShare[] {
  const payload = body as WaPayload;
  const shares: NormalizedShare[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      // `messages` carries inbound messages; `statuses` carries delivery
      // receipts for our own sends, which we ignore here.
      if (change.field && change.field !== 'messages') continue;

      for (const message of change.value?.messages ?? []) {
        const from = message.from;
        const messageId = message.id;
        if (!from || !messageId) continue;

        // WhatsApp forwards a shared reel as a plain text body — there is no
        // attachment object for it. Captions cover the media-with-link case.
        const text = message.text?.body ?? message.video?.caption ?? message.image?.caption;

        for (const url of extractUrls(text)) {
          shares.push({
            platform: 'whatsapp',
            externalId: from,
            sourceUrl: url,
            messageId,
            raw: message,
          });
        }
      }
    }
  }

  return shares;
}
