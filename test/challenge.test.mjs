import assert from "node:assert/strict";
import test from "node:test";
import { parseChallenge } from "../src/challenge.mjs";

const url = "https://service.example/v1/data";

test("normalizes a Kite x402 v2 PAYMENT-REQUIRED header", () => {
  const source = {
    x402Version: 2,
    accepts: [{
      scheme: "exact",
      network: "eip155:2368",
      amount: "1000",
      asset: "0x1111111111111111111111111111111111111111",
      payTo: "0x2222222222222222222222222222222222222222",
      maxTimeoutSeconds: 60,
    }],
  };
  const encoded = Buffer.from(JSON.stringify(source)).toString("base64url");
  const result = parseChallenge(encoded, url);
  assert.equal(result.x402Version, 2);
  assert.equal(result.accepts[0].scheme, "gokite-aa");
  assert.equal(result.accepts[0].network, "kite-testnet");
  assert.equal(result.accepts[0].maxAmountRequired, "1000");
  assert.equal(result.accepts[0].resource, url);
});

test("unwraps JSON response envelopes", () => {
  const result = parseChallenge({
    paymentRequired: { x402Version: 1, accepts: [] },
  }, url);
  assert.equal(result.x402Version, 1);
});

test("rejects malformed encoded challenges", () => {
  assert.throws(() => parseChallenge("not-json", url), /base64 JSON/);
});
