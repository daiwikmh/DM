const GRAPH = 'https://graph.instagram.com/v23.0';

interface Participant {
  id?: string;
  username?: string;
}

/**
 * Map an Instagram username to the IGSID that webhooks deliver.
 *
 * There is no public username→IGSID lookup, but the connected account's own
 * conversations carry both, so anyone who has already DMed us is resolvable —
 * which is exactly the set of people who have shares to claim.
 */
export async function resolveIgsid(handle: string): Promise<string | null> {
  const wanted = handle.trim().replace(/^@/, '').toLowerCase();
  if (!wanted) return null;

  // Already an IGSID.
  if (/^\d+$/.test(wanted)) return wanted;

  const token = process.env.IG_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('IG_PAGE_ACCESS_TOKEN is not set');

  const res = await fetch(
    `${GRAPH}/me/conversations?fields=participants&limit=100&access_token=${token}`,
  );
  if (!res.ok) throw new Error(`instagram lookup failed: ${res.status}`);

  const body = (await res.json()) as {
    data?: Array<{ participants?: { data?: Participant[] } }>;
  };

  for (const conversation of body.data ?? []) {
    for (const participant of conversation.participants?.data ?? []) {
      if (participant.id && participant.username?.toLowerCase() === wanted) {
        return participant.id;
      }
    }
  }

  return null;
}
