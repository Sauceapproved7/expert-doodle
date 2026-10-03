const STRIPE_CHECKOUT_HOST = "checkout.stripe.com";
const STRIPE_STANDARD_TEST_CARD = "4242424242424242";

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isStripeCheckoutUrl(raw) {
  try {
    const url = new URL(String(raw || ""));
    return url.protocol === "https:" && url.hostname.toLowerCase() === STRIPE_CHECKOUT_HOST;
  } catch {
    return false;
  }
}

export function isStripeSandboxCheckoutUrl(raw) {
  if (!isStripeCheckoutUrl(raw)) return false;
  try {
    const url = new URL(String(raw || ""));
    return /(?:^|\/)cs_test_[A-Za-z0-9_]+/.test(url.pathname);
  } catch {
    return false;
  }
}

export function detectOwnerCheckpointText(text) {
  const t = String(text || "").toLowerCase();
  if (/captcha|verify you are human|not a robot/.test(t)) return "captcha";
  if (/one-time code|verification code|two-factor|two factor|\bmfa\b/.test(t)) return "mfa";

  const explicitTerms =
    /\b(?:please|must|required(?:\s+to)?|need(?:\s+to)?)\b.{0,80}\b(?:accept|agree)\b.{0,80}\bterms\b/.test(t) ||
    /\b(?:i\s+)?(?:accept|agree)\s+(?:to\s+)?(?:the\s+)?terms(?:\s+(?:of\s+service|and\s+conditions))?\b/.test(t);
  if (explicitTerms) return "terms";

  if (/authorize|allow access|grant access|consent/.test(t)) return "consent";
  return null;
}

export function stripePaymentBoundary({ url, fieldInfo = "", selector = "", cardNumber = "" } = {}) {
  if (!isStripeCheckoutUrl(url)) return null;

  const surface = `${fieldInfo} ${selector}`.toLowerCase();
  const isPaymentField =
    /\bcc-(?:number|exp|csc|name)\b/.test(surface) ||
    /\bcard(?:number|expiry|expiration|exp|cvc|cvv)\b/.test(surface);
  const isPaymentSubmit =
    /type\s*=\s*['"]?submit|button\[type=['"]?submit|hosted-payment-submit-button|submitbutton/.test(surface) ||
    /\b(?:pay|purchase|place order|complete order|submit payment)\b/.test(surface);

  if (!isPaymentField && !isPaymentSubmit) return null;
  if (!isStripeSandboxCheckoutUrl(url)) return "payment";

  if (isPaymentSubmit && normalizeDigits(cardNumber) !== STRIPE_STANDARD_TEST_CARD) {
    return "payment";
  }

  return null;
}
