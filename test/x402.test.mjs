import assert from "node:assert/strict";
import test from "node:test";
import { buildPaymentRequired, decodePaymentHeader } from "../src/x402.mjs";
import { KITE_TESTNET_PIEUSD } from "../src/policy.mjs";

const config = {
  payTo: "0x1111111111111111111111111111111111111111",
  asset: KITE_TESTNET_PIEUSD,
  amount: "10000",
  network: "kite-testnet",
};

test("builds a Kite-compatible 402 challenge", () => {
  const result = buildPaymentRequired(config, "https://guard.example/v1/evaluate");
  assert.equal(result.x402Version, 1);
  assert.equal(result.accepts[0].scheme, "gokite-aa");
  assert.equal(result.accepts[0].network, "kite-testnet");
  assert.equal(result.accepts[0].asset, KITE_TESTNET_PIEUSD);
});

test("decodes base64url payment payloads", () => {
  const payload = { authorization: { nonce: "guard-1" }, signature: "0x1234" };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  assert.deepEqual(decodePaymentHeader(encoded), payload);
});

test("rejects malformed or non-object payment payloads", () => {
  assert.throws(() => decodePaymentHeader("not valid!"), /valid base64/);
  assert.throws(
    () => decodePaymentHeader(Buffer.from("[]").toString("base64url")),
    /must be an object/,
  );
});
