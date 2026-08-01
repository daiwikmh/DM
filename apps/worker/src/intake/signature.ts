import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify Meta's X-Hub-Signature-256 header.
 *
 * Must run against the exact bytes Meta sent — re-serialising the parsed JSON
 * changes key order and whitespace and the digest will not match.
 */
export function verifySignature(
  rawBody: Buffer,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!header?.startsWith('sha256=')) return false;

  const provided = Buffer.from(header.slice('sha256='.length), 'hex');
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();

  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/**
 * Meta's subscription handshake: it GETs the endpoint with a challenge and
 * expects the challenge echoed back verbatim when the token matches.
 */
export function verifyHandshake(
  params: URLSearchParams,
  verifyToken: string,
): string | null {
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token === verifyToken && challenge) return challenge;
  return null;
}
