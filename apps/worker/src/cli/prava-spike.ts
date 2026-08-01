/**
 * Phase A sandbox spike: prove the real create → approve → poll → mint cycle
 * end to end against Prava's sandbox, before wiring in Rye or the resolver.
 *
 * Run: pnpm --filter @prava/worker prava:spike
 *
 * Requires PRAVA_SECRET_KEY (sk_test_*) in .env — self-serve at
 * dashboard.prava.space, no waiting.
 */
import { createSession, waitForCredentials, reportStatus, PravaError } from '../payments/prava.ts';

async function main() {
  console.log('--- Prava sandbox spike ---\n');

  const session = await createSession({
    userId: 'demo_user_1',
    userEmail: 'demo@example.com',
    totalAmount: '179.99',
    currency: 'USD',
    merchant: {
      name: 'Nike',
      url: 'https://www.nike.com',
      countryCodeIso2: 'US',
    },
    products: [{ description: 'Air Max 90', unitPrice: '179.99', quantity: 1 }],
  });

  console.log(`Session created: ${session.sessionId}`);
  console.log(`Expires at:      ${session.expiresAt}`);
  console.log(`\nOpen this URL and approve with Face ID / Touch ID:\n`);
  console.log(`  ${session.iframeUrl}\n`);
  console.log('Use a sandbox test card — see /api-reference/test-cards in the Prava docs.\n');
  console.log('Waiting for card entry + passkey approval (up to 15 minutes)...\n');

  const credentials = await waitForCredentials(session.sessionId, {
    onTick: (status) => process.stdout.write(`  status: ${status}\r`),
  });

  console.log('\n\nCard minted:');
  console.log(`  txn_ref_id: ${credentials.txnRefId}`);
  console.log(`  token:      ${credentials.token}`);
  console.log(`  cvv:        ${credentials.dynamicCvv}`);
  console.log(`  expiry:     ${credentials.expiryMonth}/${credentials.expiryYear}`);
  console.log(
    '\nThis is where Phase B (Rye) takes over: hand this card + the merchant product URL to',
  );
  console.log('the Universal Checkout API to actually place the order.\n');

  // In the real flow this fires only after Rye confirms the merchant order —
  // reporting here is just to close the sandbox loop for this spike.
  await reportStatus({ sessionId: session.sessionId, txnRefId: credentials.txnRefId, status: 'APPROVED' });
  console.log('Reported APPROVED back to Prava.');
}

main().catch((err) => {
  if (err instanceof PravaError) {
    console.error(`\nPrava error [${err.status}${err.code ? ` ${err.code}` : ''}]: ${err.message}`);
  } else {
    console.error('\n', err);
  }
  process.exit(1);
});
