import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { matchDecline } from './shopify.ts';

describe('matchDecline', () => {
  // Captured verbatim from a live Shopify Payments checkout rejecting a Prava
  // sandbox card — note the typographic apostrophe.
  const SHOPIFY_LIVE = 'Your payment details couldn’t be verified. Check your card details and try again.';

  test('recognises the live Shopify Payments wording', () => {
    assert.equal(matchDecline(SHOPIFY_LIVE), 'payment details couldn’t be verified.');
  });

  test('recognises the same wording with an ASCII apostrophe', () => {
    assert.ok(matchDecline("Your payment details couldn't be verified."));
  });

  test('recognises other gateway phrasings', () => {
    for (const body of [
      'Your card was declined.',
      'The payment was declined by your bank.',
      'Insufficient funds on this card.',
      'Invalid card number.',
    ]) {
      assert.ok(matchDecline(body), `should match: ${body}`);
    }
  });

  test('does not fire on a successful checkout', () => {
    assert.equal(matchDecline('Thank you! Your order is confirmed.'), null);
  });
});
