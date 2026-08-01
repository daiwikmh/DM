export type IntakePlatform = 'instagram' | 'whatsapp';

/**
 * One shared reel, normalised out of a platform webhook. A single webhook
 * delivery can contain several messages and each message several attachments,
 * so parsers return an array — usually empty (most DMs aren't reels).
 */
export interface NormalizedShare {
  platform: IntakePlatform;
  /** IGSID for Instagram, E.164 phone for WhatsApp. Not a user id. */
  externalId: string;
  sourceUrl: string;
  /** Platform message id — used to drop duplicate webhook deliveries. */
  messageId: string;
  title?: string;
  raw: unknown;
}
