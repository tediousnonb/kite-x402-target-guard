import assert from "node:assert/strict";
import test from "node:test";
import { serviceDocument } from "../src/service.mjs";

test("publishes machine-readable x402 discovery metadata", () => {
  const result = serviceDocument({
    paymentDisabled: false,
    publicBaseUrl: "https://guard.example",
    network: "kite-testnet",
    asset: "0x1111111111111111111111111111111111111111",
    amount: "10000",
    payTo: "0x2222222222222222222222222222222222222222",
    facilitatorUrl: "https://facilitator.example",
  }, "https://guard.example/v1/evaluate");
  assert.equal(result.endpoint.url, "https://guard.example/v1/evaluate");
  assert.equal(result.payment.protocol, "x402");
  assert.deepEqual(result.payment.versions, [1, 2]);
  assert.ok(result.capabilities.includes("dns-ssrf-protection"));
});
