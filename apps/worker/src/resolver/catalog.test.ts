import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { searchByText, __resetCatalogTokenCacheForTests } from './catalog.ts';

let calls: Array<{ url: string; init: RequestInit }>;
let responses: Array<{ status: number; body: unknown }>;

beforeEach(() => {
  calls = [];
  responses = [];
  __resetCatalogTokenCacheForTests();
  process.env.SHOPIFY_CATALOG_CLIENT_ID = 'test_client_id';
  process.env.SHOPIFY_CATALOG_CLIENT_SECRET = 'test_secret';
  process.env.UCP_AGENT_PROFILE_URL = 'https://example.com/agent-profile.json';

  // @ts-expect-error — test double
  globalThis.fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('no mocked response queued');
    return { ok: next.status < 400, status: next.status, json: async () => next.body };
  };
});

afterEach(() => {
  delete process.env.SHOPIFY_CATALOG_CLIENT_ID;
  delete process.env.SHOPIFY_CATALOG_CLIENT_SECRET;
  delete process.env.UCP_AGENT_PROFILE_URL;
});

describe('searchByText', () => {
  test('exchanges client credentials, then calls tools/call with the profile nested under arguments.meta', async () => {
    responses.push(
      { status: 200, body: { access_token: 'shop_tok_1' } },
      {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  products: [
                    {
                      product_id: 'gid://shopify/Product/1',
                      title: 'Air Max 90',
                      merchant: 'Nike',
                      merchant_domain: 'nike.com',
                      price: '179.99',
                      currency: 'USD',
                      image_url: 'https://cdn/img.jpg',
                      url: 'https://www.nike.com/t/air-max-90',
                    },
                  ],
                }),
              },
            ],
          },
        },
      },
    );

    const results = await searchByText('Nike Air Max 90 white leather sneakers');

    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://api.shopify.com/auth/access_token');
    const tokenBody = JSON.parse(calls[0].init.body as string);
    assert.deepEqual(tokenBody, {
      client_id: 'test_client_id',
      client_secret: 'test_secret',
      grant_type: 'client_credentials',
    });

    assert.equal(calls[1].url, 'https://catalog.shopify.com/api/ucp/mcp');
    assert.equal(
      (calls[1].init.headers as Record<string, string>).authorization,
      'Bearer shop_tok_1',
    );
    const rpcBody = JSON.parse(calls[1].init.body as string);
    assert.equal(rpcBody.method, 'tools/call');
    assert.equal(rpcBody.params.name, 'search_catalog');
    assert.equal(rpcBody.params.arguments.catalog.query, 'Nike Air Max 90 white leather sneakers');
    assert.equal(
      rpcBody.params.arguments.meta['ucp-agent'].profile,
      'https://example.com/agent-profile.json',
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Air Max 90');
    assert.equal(results[0].merchant, 'Nike');
    assert.equal(results[0].priceAmount, '179.99');
  });

  test('reuses the cached token across calls within its 60-minute window', async () => {
    const okSearchResponse = {
      status: 200,
      body: { result: { content: [{ type: 'text', text: JSON.stringify({ products: [] }) }] } },
    };

    responses.push(
      { status: 200, body: { access_token: 'shop_tok_1' } },
      okSearchResponse,
      okSearchResponse,
    );

    await searchByText('first query');
    await searchByText('second query');

    // Two searches, but only one token exchange.
    const tokenCalls = calls.filter((c) => c.url === 'https://api.shopify.com/auth/access_token');
    assert.equal(tokenCalls.length, 1);
  });

  test('returns an empty list when the catalog has nothing', async () => {
    responses.push(
      { status: 200, body: { access_token: 'shop_tok_1' } },
      { status: 200, body: { result: { content: [{ type: 'text', text: JSON.stringify({ products: [] }) }] } } },
    );

    const results = await searchByText('an extremely specific query');
    assert.deepEqual(results, []);
  });

  test('throws with the RPC error message when the catalog server rejects the call', async () => {
    responses.push(
      { status: 200, body: { access_token: 'shop_tok_1' } },
      { status: 200, body: { error: { message: 'invalid agent profile' } } },
    );

    await assert.rejects(() => searchByText('query'), /invalid agent profile/);
  });
});
