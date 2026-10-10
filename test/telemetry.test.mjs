import assert from "node:assert/strict";
import test from "node:test";
import { Telemetry } from "../src/telemetry.mjs";

test("aggregates request status and duration metrics", () => {
  const telemetry = new Telemetry();
  telemetry.observe(200, 10);
  telemetry.observe(200, 20);
  telemetry.observe(402, 3);
  const result = telemetry.snapshot();
  assert.equal(result.requests, 3);
  assert.deepEqual(result.responses, { 200: 2, 402: 1 });
  assert.equal(result.averageDurationMs, 11);
  assert.match(telemetry.prometheus(), /status="402"\} 1/);
});
