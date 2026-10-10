import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.mjs";

test("loads a safe local development configuration", () => {
  const config = loadConfig({ PAYMENT_DISABLED: "true", PORT: "9000" });
  assert.equal(config.port, 9000);
  assert.equal(config.paymentDisabled, true);
  assert.equal(config.network, "kite-testnet");
});

test("refuses paid mode without a usable payee", () => {
  assert.throws(() => loadConfig({}), /PAYEE_WALLET/);
});

test("normalizes public origins and facilitator URLs", () => {
  const config = loadConfig({
    PAYMENT_DISABLED: "true",
    PUBLIC_BASE_URL: "https://guard.example/path",
    FACILITATOR_URL: "https://facilitator.example/",
  });
  assert.equal(config.publicBaseUrl, "https://guard.example");
  assert.equal(config.facilitatorUrl, "https://facilitator.example");
});
