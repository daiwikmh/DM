import { getPaymentResult } from './src/payments/prava.ts';

// After report-status lands, the payment result's status becomes 'completed'.
// If it is still 'awaiting_result', Prava never got the outcome.
for (const sessionId of process.argv.slice(2)) {
  const result = await getPaymentResult(sessionId);
  console.log(sessionId, '→ status:', result.status, '| error:', result.error?.code ?? 'none');
}
process.exit(0);
