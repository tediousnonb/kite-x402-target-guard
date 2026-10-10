import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultPolicy,
  createPolicy,
  evaluateTarget,
  isBlockedAddress,
  KITE_TESTNET_PIEUSD,
} from "../src/policy.mjs";

const targetUrl = "https://merchant.example/v1/data?city=shanghai";
const payTo = "0x1111111111111111111111111111111111111111";

function challenge(overrides = {}) {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "gokite-aa",
        network: "kite-testnet",
        maxAmountRequired: "10000",
        resource: targetUrl,
        payTo,
        asset: KITE_TESTNET_PIEUSD,
        maxTimeoutSeconds: 300,
        ...overrides,
      },
    ],
  };
}

const publicResolver = async () => [{ address: "8.8.8.8", family: 4 }];

test("allows a valid Kite testnet x402 target", async () => {
  const result = await evaluateTarget(
    { url: targetUrl, challenge: challenge() },
    defaultPolicy,
    publicResolver,
  );
  assert.equal(result.allowed, true);
  assert.equal(result.score, 0);
  assert.equal(result.selectedOffer.network, "kite-testnet");
});

test("blocks private, loopback, link-local and mapped addresses", () => {
  for (const address of [
    "10.0.0.1",
    "127.0.0.1",
    "169.254.1.1",
    "192.168.1.1",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "::1",
    "fd00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
  assert.equal(isBlockedAddress("8.8.8.8"), false);
  assert.equal(isBlockedAddress("2606:4700:4700::1111"), false);
});

test("blocks a host that resolves to any private address", async () => {
  const result = await evaluateTarget(
    { url: targetUrl, challenge: challenge() },
    defaultPolicy,
    async () => ["8.8.8.8", "10.0.0.5"],
  );
  assert.equal(result.allowed, false);
  assert.ok(result.findings.some((item) => item.code === "PRIVATE_ADDRESS"));
});

test("blocks insecure URLs and embedded credentials", async () => {
  const url = "http://user:pass@merchant.example/v1/data";
  const result = await evaluateTarget(
    { url, challenge: challenge({ resource: url }) },
    defaultPolicy,
    publicResolver,
  );
  assert.equal(result.allowed, false);
  assert.ok(result.findings.some((item) => item.code === "HTTPS_REQUIRED"));
  assert.ok(result.findings.some((item) => item.code === "URL_CREDENTIALS"));
});

test("blocks excessive amounts and unsupported assets", async () => {
  const result = await evaluateTarget(
    {
      url: targetUrl,
      challenge: challenge({
        maxAmountRequired: "1000001",
        asset: "0x2222222222222222222222222222222222222222",
      }),
    },
    defaultPolicy,
    publicResolver,
  );
  assert.equal(result.allowed, false);
  assert.ok(result.findings.some((item) => item.code === "AMOUNT_EXCEEDS_LIMIT"));
  assert.ok(result.findings.some((item) => item.code === "ASSET_UNSUPPORTED"));
});

test("blocks resource substitution", async () => {
  const result = await evaluateTarget(
    {
      url: targetUrl,
      challenge: challenge({ resource: "https://merchant.example/v1/other" }),
    },
    defaultPolicy,
    publicResolver,
  );
  assert.equal(result.allowed, false);
  assert.ok(result.findings.some((item) => item.code === "RESOURCE_MISMATCH"));
});

test("returns a closed decision when DNS resolution fails", async () => {
  const result = await evaluateTarget(
    { url: targetUrl, challenge: challenge() },
    defaultPolicy,
    async () => {
      throw new Error("NXDOMAIN");
    },
  );
  assert.equal(result.allowed, false);
  assert.ok(result.findings.some((item) => item.code === "DNS_FAILURE"));
});

test("enforces operator host allowlists and denylists", async () => {
  const allowed = await evaluateTarget(
    { url: targetUrl, challenge: challenge() },
    createPolicy({ allowedHosts: ["*.example"] }),
    publicResolver,
  );
  assert.equal(allowed.allowed, true);

  const blocked = await evaluateTarget(
    { url: targetUrl, challenge: challenge() },
    createPolicy({ blockedHosts: ["merchant.example"] }),
    publicResolver,
  );
  assert.ok(blocked.findings.some((item) => item.code === "HOST_BLOCKED"));
});

test("deduplicates DNS answers in the decision record", async () => {
  const result = await evaluateTarget(
    { url: targetUrl, challenge: challenge() },
    defaultPolicy,
    async () => ["8.8.8.8", "8.8.8.8"],
  );
  assert.deepEqual(result.resolvedAddresses, ["8.8.8.8"]);
});
