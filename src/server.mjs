import { createServer } from "node:http";
import { evaluateTarget } from "./policy.mjs";
import {
  buildPaymentRequired,
  decodePaymentHeader,
  verifyAndSettle,
} from "./x402.mjs";
import { loadConfig } from "./config.mjs";
import { parseChallenge } from "./challenge.mjs";
import { AuditLog } from "./audit.mjs";
import { serviceDocument } from "./service.mjs";
import { staticAsset } from "./static.mjs";

const config = loadConfig();
const auditLog = new AuditLog();

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Request body exceeds 64 KiB");
    chunks.push(chunk);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Request body must be a JSON object");
  }
  return body;
}

function requestUrl(request) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string" ? forwardedProto.split(",")[0] : "http";
  const host = request.headers.host ?? `localhost:${config.port}`;
  return new URL(request.url ?? "/", `${protocol}://${host}`);
}

function publicResource(request) {
  if (config.publicBaseUrl) {
    return new URL("/v1/evaluate", config.publicBaseUrl).href;
  }
  const url = requestUrl(request);
  url.pathname = "/v1/evaluate";
  url.search = "";
  return url.href;
}

async function handleEvaluate(request, response) {
  const paymentHeader = request.headers["x-payment"];
  if (!config.paymentDisabled && typeof paymentHeader !== "string") {
    try {
      return sendJson(
        response,
        402,
        buildPaymentRequired(config, publicResource(request)),
      );
    } catch (error) {
      return sendJson(response, 503, {
        error: error instanceof Error ? error.message : "Service misconfigured",
      });
    }
  }

  let input;
  try {
    input = await readJson(request);
    if (typeof input.url !== "string") {
      return sendJson(response, 400, { error: "url must be a string" });
    }
    input.challenge = parseChallenge(input.challenge, input.url);
  } catch (error) {
    return sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Invalid request",
    });
  }

  let receipt = null;
  if (!config.paymentDisabled) {
    try {
      decodePaymentHeader(paymentHeader);
      receipt = await verifyAndSettle(paymentHeader, config);
    } catch (error) {
      return sendJson(response, 402, {
        error: error instanceof Error ? error.message : "Payment failed",
      });
    }
  }

  try {
    const result = await evaluateTarget(input, config.policy);
    const audit = auditLog.append({
      result,
      mode: config.paymentDisabled ? "local-free" : "x402-paid",
      receipt,
    });
    return sendJson(response, 200, {
      ok: true,
      mode: config.paymentDisabled ? "local-free" : "x402-paid",
      result,
      receipt,
      auditId: audit.id,
    });
  } catch (error) {
    return sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Evaluation failed",
    });
  }
}

export const server = createServer(async (request, response) => {
  const url = requestUrl(request);
  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, {
      ok: true,
      service: "kite-x402-target-guard",
      paymentMode: config.paymentDisabled ? "disabled" : "x402",
      auditEntries: auditLog.size,
    });
  }
  if (request.method === "GET" && url.pathname === "/v1/audits") {
    const allowedValue = url.searchParams.get("allowed");
    const allowed = allowedValue === null ? undefined : allowedValue === "true";
    const limit = Number(url.searchParams.get("limit") ?? 50);
    return sendJson(response, 200, {
      entries: auditLog.list({ limit: Number.isFinite(limit) ? limit : 50, allowed }),
    });
  }
  if (
    request.method === "GET" &&
    ["/.well-known/x402", "/v1/service"].includes(url.pathname)
  ) {
    return sendJson(response, 200, serviceDocument(config, publicResource(request)));
  }
  if (request.method === "GET") {
    const asset = await staticAsset(url.pathname);
    if (asset) {
      response.writeHead(200, {
        "content-type": asset.contentType,
        "cache-control": url.pathname === "/" ? "no-cache" : "public, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
      });
      return response.end(asset.body);
    }
  }
  if (request.method === "POST" && url.pathname === "/v1/evaluate") {
    return handleEvaluate(request, response);
  }
  return sendJson(response, 404, { error: "Not found" });
});

if (process.env.NODE_ENV !== "test") {
  server.listen(config.port, () => {
    console.log(`Kite x402 Target Guard listening on :${config.port}`);
  });
}
