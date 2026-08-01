import { chromium, type Frame, type Page } from 'playwright';

export interface ShippingDetails {
  email: string;
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  postalCode: string;
  /** ISO-2, e.g. "IN". Shopify's country select is keyed by it. */
  countryCode: string;
  province?: string;
  phone?: string;
}

export interface CardCredentials {
  token: string;
  dynamicCvv: string;
  expiryMonth: string;
  expiryYear: string;
}

export interface CheckoutResult {
  status: 'placed' | 'declined' | 'failed';
  message: string;
  /** Final page URL, useful for confirming an order id landed. */
  url?: string;
  screenshot?: string;
}

/**
 * Drive a Shopify checkout with the card Prava minted.
 *
 * Deliberately Shopify-only: its checkout is the one flow standardised enough
 * across merchants to automate without per-store scripting. Anything else
 * fails fast rather than half-completing a purchase.
 *
 * This is inherently brittle — it depends on another company's DOM, and
 * storefronts customise their product pages heavily. Every step therefore
 * fails loudly with a screenshot rather than pressing on.
 */
export async function executeCheckout(params: {
  productUrl: string;
  card: CardCredentials;
  shipping: ShippingDetails;
  headless?: boolean;
  /** Fill everything but never submit — for exercising the driver safely. */
  dryRun?: boolean;
}): Promise<CheckoutResult> {
  const { productUrl, card, shipping, headless = true, dryRun = false } = params;

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ locale: 'en-IN' });
  const page = await context.newPage();

  const fail = async (message: string): Promise<CheckoutResult> => ({
    status: 'failed',
    message,
    url: page.url(),
    screenshot: (await page.screenshot({ fullPage: false }).catch(() => null))?.toString('base64'),
  });

  try {
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    const origin = new URL(page.url()).origin;
    if (!(await isShopify(page))) {
      return await fail('not a Shopify storefront — only Shopify checkout is automated');
    }

    if (!(await addToCart(page))) {
      return await fail('could not find an add-to-cart control on the product page');
    }

    await page.goto(`${origin}/checkout`, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    await fillContactAndShipping(page, shipping);
    await advance(page, /continue to shipping|continue to delivery/i);
    await advance(page, /continue to payment/i);

    if (!(await fillCard(page, card, shipping))) {
      // Most Indian Shopify stores sell through PayU/Razorpay/Cashfree rather
      // than Shopify Payments. Those collect the card on their own hosted page
      // after a redirect, so no card fields exist here to fill.
      const body = (await page.textContent('body').catch(() => '')) ?? '';
      const gateway = body.match(/redirected to ([^.]{3,60}?) to complete your purchase/i);

      return await fail(
        gateway
          ? `store checks out via ${gateway[1].trim()}, which collects the card on its own page — this driver only fills Shopify Payments fields`
          : 'could not find the card fields on the payment step',
      );
    }

    if (dryRun) {
      return {
        status: 'failed',
        message: 'dry run — reached the payment step with the card filled, did not submit',
        url: page.url(),
        screenshot: (await page.screenshot().catch(() => null))?.toString('base64'),
      };
    }

    await advance(page, /pay now|complete order|pay ₹|pay \$/i);

    return await readOutcome(page);
  } catch (err) {
    return await fail(err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
  }
}

async function isShopify(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      'Shopify' in window ||
      Boolean(document.querySelector('script[src*="cdn.shopify.com"], link[href*="cdn.shopify.com"]')),
  );
}

async function addToCart(page: Page): Promise<boolean> {
  const candidates = [
    page.locator('form[action*="/cart/add"] button[type="submit"]').first(),
    page.locator('button[name="add"]').first(),
    page.getByRole('button', { name: /add to (cart|bag)/i }).first(),
  ];

  for (const button of candidates) {
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 10_000 });
      await page.waitForTimeout(2500);
      return true;
    }
  }

  return false;
}

/** Shopify renders each step differently across versions; try every label it uses. */
async function fillFirst(
  scope: Page | Frame,
  selectors: string[],
  value: string,
): Promise<boolean> {
  for (const selector of selectors) {
    const field = scope.locator(selector).first();
    if (await field.isVisible().catch(() => false)) {
      await field.fill(value, { timeout: 10_000 });
      return true;
    }
  }
  return false;
}

async function fillContactAndShipping(page: Page, s: ShippingDetails): Promise<void> {
  await page.waitForTimeout(3000);

  await fillFirst(page, ['input#email', 'input[name="email"]', 'input[type="email"]'], s.email);

  const country = page.locator('select[name*="countryCode"], select#Select0').first();
  if (await country.isVisible().catch(() => false)) {
    await country.selectOption(s.countryCode).catch(() => undefined);
  }

  await fillFirst(page, ['input[name*="firstName"]', 'input#TextField0'], s.firstName);
  await fillFirst(page, ['input[name*="lastName"]', 'input#TextField1'], s.lastName);
  await fillFirst(page, ['input[name*="address1"]', 'input#shipping-address1'], s.address1);
  await fillFirst(page, ['input[name*="city"]'], s.city);
  await fillFirst(page, ['input[name*="postalCode"]', 'input[name*="zip"]'], s.postalCode);

  if (s.phone) await fillFirst(page, ['input[name*="phone"]'], s.phone);

  if (s.province) {
    const province = page.locator('select[name*="zone"], select[name*="province"]').first();
    if (await province.isVisible().catch(() => false)) {
      await province.selectOption({ label: s.province }).catch(() => undefined);
    }
  }
}

async function advance(page: Page, label: RegExp): Promise<void> {
  const button = page.getByRole('button', { name: label }).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click({ timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => undefined);
    await page.waitForTimeout(2500);
  }
}

/**
 * Shopify isolates card inputs in iframes, one field per frame, named
 * `card-fields-<field>-<id>`. On the current one-page checkout the payment
 * section renders lazily as it scrolls into view, so the frames simply do not
 * exist until then — waiting for them without scrolling waits forever.
 */
async function waitForCardFrames(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(1500);

    if (page.frames().some((f) => /card-fields|card_fields/i.test(f.name() + f.url()))) {
      return true;
    }
  }

  return false;
}

async function fillCard(page: Page, card: CardCredentials, s: ShippingDetails): Promise<boolean> {
  await page.waitForTimeout(3000);
  await waitForCardFrames(page);

  const expiry = `${card.expiryMonth.padStart(2, '0')}/${card.expiryYear.slice(-2)}`;
  const wanted: Array<[RegExp, string, string[]]> = [
    [/number/i, card.token, ['input[name="number"]', 'input#number']],
    [/name/i, `${s.firstName} ${s.lastName}`, ['input[name="name"]', 'input#name']],
    [/expiry|expiration/i, expiry, ['input[name="expiry"]', 'input#expiry']],
    [/verification|cvv|cvc|security/i, card.dynamicCvv, ['input[name="verification_value"]']],
  ];

  let filled = 0;

  for (const [framePattern, value, selectors] of wanted) {
    const frame = page
      .frames()
      .find((f) => framePattern.test(f.name()) || framePattern.test(f.url()));

    const scope = frame ?? page;
    if (await fillFirst(scope, selectors, value)) filled += 1;
  }

  return filled >= 3;
}

/**
 * Recognise a gateway's rejection of the card.
 *
 * Shopify Payments says "payment details couldn't be verified" rather than
 * "declined", and renders a typographic apostrophe (U+2019) — matching only
 * ASCII reads a real gateway verdict as an unrecognised state, which loses the
 * one outcome that proves the card reached a processor.
 */
export function matchDecline(body: string): string | null {
  const match = body.match(
    /(payment details could(n[''’]t| not) be verified[^.]*\.?|card was declined|payment (was )?declined|could not be processed|insufficient funds|invalid card|verification failed)/i,
  );

  return match ? match[0].trim() : null;
}

async function readOutcome(page: Page): Promise<CheckoutResult> {
  await page.waitForTimeout(6000);

  const url = page.url();
  const body = (await page.textContent('body').catch(() => '')) ?? '';

  if (/thank you|order confirmed|your order is confirmed/i.test(body) || /\/orders\//.test(url)) {
    return { status: 'placed', message: 'Order confirmed by the merchant.', url };
  }

  const declined = matchDecline(body);
  if (declined) {
    return { status: 'declined', message: declined, url };
  }

  return {
    status: 'failed',
    message: 'Checkout finished in an unrecognised state.',
    url,
    screenshot: (await page.screenshot().catch(() => null))?.toString('base64'),
  };
}
