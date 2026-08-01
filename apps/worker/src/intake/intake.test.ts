import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySignature, verifyHandshake } from './signature.ts';
import { extractUrls, canonicalize } from './extract-url.ts';
import { parseInstagram } from './instagram.ts';
import { parseWhatsApp } from './whatsapp.ts';

const SECRET = 'test_app_secret';

const sign = (body: string) =>
  'sha256=' + createHmac('sha256', SECRET).update(Buffer.from(body)).digest('hex');

describe('signature', () => {
  test('accepts a correct digest', () => {
    const body = '{"object":"instagram"}';
    assert.equal(verifySignature(Buffer.from(body), sign(body), SECRET), true);
  });

  test('rejects a digest computed over different bytes', () => {
    const body = '{"object":"instagram"}';
    // Same JSON semantically, different bytes — this is why the raw buffer matters.
    const reserialized = '{"object": "instagram"}';
    assert.equal(verifySignature(Buffer.from(reserialized), sign(body), SECRET), false);
  });

  test('rejects a missing or malformed header', () => {
    assert.equal(verifySignature(Buffer.from('{}'), undefined, SECRET), false);
    assert.equal(verifySignature(Buffer.from('{}'), 'sha1=abc', SECRET), false);
  });
});

describe('handshake', () => {
  test('echoes the challenge when the token matches', () => {
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'tok',
      'hub.challenge': '12345',
    });
    assert.equal(verifyHandshake(params, 'tok'), '12345');
  });

  test('refuses a wrong token', () => {
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong',
      'hub.challenge': '12345',
    });
    assert.equal(verifyHandshake(params, 'tok'), null);
  });
});

describe('url extraction', () => {
  test('strips share and campaign tracking so repeats dedupe', () => {
    assert.equal(
      canonicalize('https://www.instagram.com/reel/ABC123/?igsh=xyz&utm_source=ig_web'),
      'https://www.instagram.com/reel/ABC123',
    );
  });

  test('ignores hosts we cannot resolve', () => {
    assert.deepEqual(extractUrls('check https://example.com/thing'), []);
  });

  test('pulls a reel link out of surrounding text and trailing punctuation', () => {
    assert.deepEqual(
      extractUrls('omg look at this https://www.instagram.com/reel/ABC123/.'),
      ['https://www.instagram.com/reel/ABC123'],
    );
  });
});

describe('instagram', () => {
  test('reads a shared reel attachment', () => {
    const shares = parseInstagram({
      object: 'instagram',
      entry: [
        {
          messaging: [
            {
              sender: { id: 'IGSID_123' },
              message: {
                mid: 'mid_1',
                attachments: [
                  {
                    type: 'ig_reel',
                    payload: {
                      url: 'https://www.instagram.com/reel/ABC123/?igsh=drop',
                      title: 'linen shirt haul',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    assert.equal(shares.length, 1);
    assert.deepEqual(
      { ...shares[0], raw: undefined },
      {
        platform: 'instagram',
        externalId: 'IGSID_123',
        sourceUrl: 'https://www.instagram.com/reel/ABC123',
        messageId: 'mid_1',
        title: 'linen shirt haul',
        raw: undefined,
      },
    );
  });

  test('ignores echoes of our own outbound replies', () => {
    const shares = parseInstagram({
      entry: [
        {
          messaging: [
            {
              sender: { id: 'IGSID_123' },
              message: {
                mid: 'mid_2',
                is_echo: true,
                attachments: [
                  { type: 'ig_reel', payload: { url: 'https://www.instagram.com/reel/X/' } },
                ],
              },
            },
          ],
        },
      ],
    });

    assert.deepEqual(shares, []);
  });

  test('ignores non-shareable attachments', () => {
    const shares = parseInstagram({
      entry: [
        {
          messaging: [
            {
              sender: { id: 'IGSID_123' },
              message: {
                mid: 'mid_3',
                attachments: [{ type: 'image', payload: { url: 'https://cdn/x.jpg' } }],
              },
            },
          ],
        },
      ],
    });

    assert.deepEqual(shares, []);
  });

  test('does not double-count a link that is both attached and pasted', () => {
    const shares = parseInstagram({
      entry: [
        {
          messaging: [
            {
              sender: { id: 'IGSID_123' },
              message: {
                mid: 'mid_4',
                text: 'https://www.instagram.com/reel/ABC123/',
                attachments: [
                  {
                    type: 'ig_reel',
                    payload: { url: 'https://www.instagram.com/reel/ABC123/?igsh=z' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    assert.equal(shares.length, 1);
  });
});

describe('whatsapp', () => {
  test('reads a reel link out of a text body', () => {
    const shares = parseWhatsApp({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    id: 'wamid.1',
                    from: '447700900000',
                    type: 'text',
                    text: { body: 'this one https://www.instagram.com/reel/XYZ/' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    assert.equal(shares.length, 1);
    assert.equal(shares[0].externalId, '447700900000');
    assert.equal(shares[0].sourceUrl, 'https://www.instagram.com/reel/XYZ');
  });

  test('ignores delivery-status callbacks', () => {
    const shares = parseWhatsApp({
      entry: [
        {
          changes: [
            { field: 'statuses', value: { messages: [] } },
          ],
        },
      ],
    });

    assert.deepEqual(shares, []);
  });

  test('ignores a plain chat message with no link', () => {
    const shares = parseWhatsApp({
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  { id: 'wamid.2', from: '447700900000', type: 'text', text: { body: 'hey' } },
                ],
              },
            },
          ],
        },
      ],
    });

    assert.deepEqual(shares, []);
  });
});
