import assert from "node:assert/strict";
import test from "node:test";
import { AuditLog } from "../src/audit.mjs";

const result = (allowed, hostname) => ({
  allowed,
  score: allowed ? 0 : 40,
  target: { hostname },
  findings: allowed ? [] : [{ code: "HOST_BLOCKED" }],
  selectedOffer: { network: "kite-testnet", amount: "1000" },
});

test("keeps bounded, newest-first decision history", () => {
  const log = new AuditLog(2);
  log.append({ result: result(true, "one.example"), mode: "local-free" });
  log.append({ result: result(false, "two.example"), mode: "local-free" });
  log.append({ result: result(true, "three.example"), mode: "local-free" });
  assert.equal(log.size, 2);
  assert.deepEqual(log.list().map((entry) => entry.hostname), ["three.example", "two.example"]);
});

test("filters history without retaining request secrets", () => {
  const log = new AuditLog();
  const entry = log.append({ result: result(false, "merchant.example"), mode: "x402-paid" });
  assert.equal(log.list({ allowed: false }).length, 1);
  assert.equal("url" in entry, false);
  assert.deepEqual(entry.findingCodes, ["HOST_BLOCKED"]);
});
