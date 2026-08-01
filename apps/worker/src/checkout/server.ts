import { createServer, type IncomingMessage } from 'node:http';
import { executeCheckout, type CardCredentials, type ShippingDetails } from './shopify.ts';

interface ExecuteRequest {
  productUrl?: string;
  card?: CardCredentials;
  shipping?: ShippingDetails;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Order execution, kept off the intake server on purpose.
 *
 * Intake is published through a tunnel; an endpoint that spends a minted card
 * must never be reachable that way, so this binds to loopback only. Anything
 * calling it has to already be on the machine.
 */
export function startCheckoutServer(port: number): void {
  createServer((req, res) => {
    void (async () => {
      if (req.method !== 'POST' || req.url !== '/execute') {
        res.writeHead(404, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ status: 'failed', message: 'not found' }));
      }

      let body: ExecuteRequest;
      try {
        body = JSON.parse(await readBody(req)) as ExecuteRequest;
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ status: 'failed', message: 'invalid JSON' }));
      }

      if (!body.productUrl || !body.card || !body.shipping) {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(
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
      console.log(`checkout: ${result.status} — ${result.message}`);

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
    })().catch((err) => {
      console.error('checkout: unhandled error', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'failed', message: String(err) }));
      }
    });
  }).listen(port, '127.0.0.1', () => {
    console.log(`checkout executor listening on 127.0.0.1:${port}`);
  });
}
