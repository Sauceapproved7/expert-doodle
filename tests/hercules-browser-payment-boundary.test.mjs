import test from "node:test";
import assert from "node:assert/strict";
import {
  detectOwnerCheckpointText,
  isStripeSandboxCheckoutUrl,
  stripePaymentBoundary
} from "../render/hercules-browser-standalone/checkpoints.mjs";

test("passive Stripe legal copy is not treated as owner Terms acceptance", () => {
  assert.equal(
    detectOwnerCheckpointText("By paying, you agree to Link’s Terms and Privacy."),
    null
  );
  assert.equal(
    detectOwnerCheckpointText("Please accept the Terms and Conditions to continue."),
    "terms"
  );
  assert.equal(
    detectOwnerCheckpointText("I agree to the Terms of Service"),
    "terms"
  );
});

test("only Stripe test-mode checkout URLs qualify as sandbox payment surfaces", () => {
  assert.equal(
    isStripeSandboxCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_123"),
    true
  );
  assert.equal(
    isStripeSandboxCheckoutUrl("https://checkout.stripe.com/c/pay/cs_live_123"),
    false
  );
  assert.equal(
    isStripeSandboxCheckoutUrl("https://example.com/c/pay/cs_test_123"),
    false
  );
});

test("live Stripe payment controls stay owner-gated while sandbox test controls are allowed", () => {
  assert.equal(
    stripePaymentBoundary({
      url: "https://checkout.stripe.com/c/pay/cs_live_123",
      fieldInfo: "input cc-number card number",
      selector: "#cardNumber"
    }),
    "payment"
  );

  assert.equal(
    stripePaymentBoundary({
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
      fieldInfo: "input cc-number card number",
      selector: "#cardNumber"
    }),
    null
  );

  assert.equal(
    stripePaymentBoundary({
      url: "https://checkout.stripe.com/c/pay/cs_live_123",
      fieldInfo: "button submit pay",
      selector: "button[type='submit']"
    }),
    "payment"
  );
});

test("sandbox payment submission requires Stripe's standard test card", () => {
  const testUrl = "https://checkout.stripe.com/c/pay/cs_test_123";

  assert.equal(
    stripePaymentBoundary({
      url: testUrl,
      fieldInfo: "button submit pay",
      selector: "button[type='submit']",
      cardNumber: "4242 4242 4242 4242"
    }),
    null
  );

  assert.equal(
    stripePaymentBoundary({
      url: testUrl,
      fieldInfo: "button submit pay",
      selector: "button[type='submit']",
      cardNumber: "4111 1111 1111 1111"
    }),
    "payment"
  );
});
