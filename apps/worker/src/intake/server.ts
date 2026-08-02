import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { executeCheckout, type CardCredentials, type ShippingDetails } from '../checkout/shopify.ts';
import { verifyHandshake, verifySignature } from './signature.ts';
import { parseInstagram } from './instagram.ts';
import { parseWhatsApp } from './whatsapp.ts';
import { recordShares } from './store.ts';
import type { NormalizedShare } from './types.ts';

const ROUTES: Record<string, (body: unknown) => NormalizedShare[]> = {
  '/webhooks/instagram': parseInstagram,
  '/webhooks/whatsapp': parseWhatsApp,
};

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body = ''): void {
  res.writeHead(status, { 'content-type': 'text/plain' });
  res.end(body);
}

/**
 * Constant-time check of the executor's shared secret.
 *
 * Once the worker is hosted, /execute is on the public internet next to the
 * webhooks — and it spends minted cards. The secret is the only thing between
 * a stranger and a purchase, so it is required whenever one is configured, and
 * the route is refused outright when none is set.
 */
function executorAuthorised(req: IncomingMessage): boolean {
  const expected = process.env.CHECKOUT_SHARED_SECRET;
  if (!expected) return false;

  const provided = req.headers['x-checkout-secret'];
  const supplied = Array.isArray(provided) ? provided[0] : provided;
  if (!supplied) return false;

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function runCheckout(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!executorAuthorised(req)) {
    res.writeHead(401, { 'content-type': 'application/json' });
    return void res.end(
      JSON.stringify({ status: 'failed', message: 'missing or invalid x-checkout-secret' }),
    );
  }

  let body: { productUrl?: string; card?: CardCredentials; shipping?: ShippingDetails };
  try {
    body = JSON.parse((await readRawBody(req)).toString('utf8'));
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    return void res.end(JSON.stringify({ status: 'failed', message: 'invalid JSON' }));
  }

  if (!body.productUrl || !body.card || !body.shipping) {
    res.writeHead(400, { 'content-type': 'application/json' });
    return void res.end(
      JSON.stringify({ status: 'failed', message: 'productUrl, card and shipping are required' }),
    );
  }

  console.log(`checkout: driving ${body.productUrl}`);
  const result = await executeCheckout({
    productUrl: body.productUrl,
    card: body.card,
    shipping: body.shipping,
    headless: process.env.CHECKOUT_HEADLESS !== 'false',
  });

  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(result));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const parse = ROUTES[url.pathname];

  if (url.pathname === '/health') return send(res, 200, 'ok');

  // Prava's callback_url must be https, and the app runs on http://localhost in
  // development. This tunnel is already https, so it bounces the cardholder
  // back to the app. The destination is fixed, never taken from the query, so
  // it can't be turned into an open redirect.
  if (url.pathname === '/prava/return') {
    // `to` says which app opened the session, so one worker can serve both the
    // local and the deployed front end. Checked against an allowlist, because
    // an unvalidated redirect here would be an open redirect on a public host.
    const allowed = (process.env.RETURN_ORIGINS ?? 'http://localhost:4321')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    const requested = url.searchParams.get('to');
    const site = requested && allowed.includes(requested) ? requested : allowed[0];

    res.writeHead(302, { location: `${site}/checkouts` });
    return res.end();
  }
  if (url.pathname === '/execute' && req.method === 'POST') return runCheckout(req, res);

  if (!parse) return send(res, 404, 'not found');

  if (req.method === 'GET') {
    const challenge = verifyHandshake(url.searchParams, requireEnv('META_VERIFY_TOKEN'));
    return challenge ? send(res, 200, challenge) : send(res, 403, 'forbidden');
  }

  if (req.method !== 'POST') return send(res, 405, 'method not allowed');

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-hub-signature-256'];

  if (!verifySignature(rawBody, asHeader(signature), requireEnv('META_APP_SECRET'))) {
    return send(res, 401, 'bad signature');
  }

  let parsed: NormalizedShare[];
  try {
    parsed = parse(JSON.parse(rawBody.toString('utf8')));
  } catch {
    // Malformed body: acknowledge so Meta stops retrying a delivery that will
    // never succeed, and log it for inspection.
    console.error('intake: unparseable payload on', url.pathname);
    return send(res, 200, 'ok');
  }

  if (parsed.length === 0) return send(res, 200, 'ok');

  // Persist before acknowledging. It costs a couple of inserts inside Meta's
  // timeout, but a DB failure then surfaces as a retryable 500 instead of a
  // share that is lost while Meta believes it was delivered. Retrying is safe:
  // the shares_dedupe index makes recordShares idempotent.
  try {
    const queued = await recordShares(parsed);
    console.log(`intake: ${url.pathname} → ${queued}/${parsed.length} queued`);
  } catch (err) {
    console.error('intake: failed to record shares', err);
    return send(res, 500, 'error');
  }

  send(res, 200, 'ok');
}

function asHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function startIntakeServer(port: number): void {
  createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error('intake: unhandled error', err);
      if (!res.headersSent) send(res, 500, 'error');
    });
    // 0.0.0.0 so a container platform can route to it; /execute is protected
    // by CHECKOUT_SHARED_SECRET rather than by being unreachable.
  }).listen(port, '0.0.0.0', () => {
    console.log(`worker listening on :${port} (webhooks + /execute)`);
  });
}
