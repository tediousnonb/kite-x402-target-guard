import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { KITE_TESTNET_PIEUSD } from "../src/policy.mjs";

async function availablePort() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function waitForHealth(origin) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${origin}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("server did not become ready");
}

test("serves the complete free-mode evaluation workflow", async (context) => {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), PAYMENT_DISABLED: "true" },
    stdio: "ignore",
  });
  context.after(() => child.kill("SIGTERM"));
  await waitForHealth(origin);

  const consoleResponse = await fetch(origin);
  assert.equal(consoleResponse.status, 200);
  assert.match(await consoleResponse.text(), /Target Guard/);

  const discovery = await fetch(`${origin}/.well-known/x402`).then((response) => response.json());
  assert.equal(discovery.endpoint.paymentRequired, false);

  const target = "https://8.8.8.8/v1/data";
  const evaluation = await fetch(`${origin}/v1/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: target,
      challenge: {
        x402Version: 1,
        accepts: [{
          scheme: "gokite-aa",
          network: "kite-testnet",
          maxAmountRequired: "10000",
          resource: target,
          payTo: "0x1111111111111111111111111111111111111111",
          asset: KITE_TESTNET_PIEUSD,
          maxTimeoutSeconds: 60,
        }],
      },
    }),
  });
  const evaluationBody = await evaluation.json();
  assert.equal(evaluation.status, 200);
  assert.equal(evaluationBody.result.allowed, true);
  assert.ok(evaluationBody.auditId);

  const audits = await fetch(`${origin}/v1/audits`).then((response) => response.json());
  assert.equal(audits.entries.length, 1);
  assert.equal(audits.entries[0].hostname, "8.8.8.8");

  const metrics = await fetch(`${origin}/metrics`).then((response) => response.text());
  assert.match(metrics, /target_guard_http_requests_total [4-9]/);
});
