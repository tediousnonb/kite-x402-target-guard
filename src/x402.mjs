const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export function buildPaymentRequired(config, resource) {
  if (!ADDRESS.test(config.payTo) || /^0x0{40}$/.test(config.payTo)) {
    throw new Error("PAYEE_WALLET must be a non-zero EVM address");
  }
  if (!ADDRESS.test(config.asset)) {
    throw new Error("PAYMENT_ASSET must be an EVM address");
  }
  if (!/^\d+$/.test(config.amount)) {
    throw new Error("PAYMENT_AMOUNT must be an integer string");
  }
  return {
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts: [
      {
        scheme: "gokite-aa",
        network: config.network,
        maxAmountRequired: config.amount,
        resource,
        description: "Evaluate an x402 target before an agent pays",
        mimeType: "application/json",
        payTo: config.payTo,
        asset: config.asset,
        maxTimeoutSeconds: 300,
        merchantName: "Kite x402 Target Guard",
      },
    ],
  };
}

export function decodePaymentHeader(header) {
  const encoded = header.trim();
  if (!encoded || encoded.length > 32_768) {
    throw new Error("X-PAYMENT header has an invalid size");
  }
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(encoded)) {
    throw new Error("X-PAYMENT header is not valid base64");
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("X-PAYMENT header is not valid JSON");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("X-PAYMENT payload must be an object");
  }
  return payload;
}

async function postJson(url, body, timeoutMs) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Facilitator rejected request (${response.status})`);
  }
  return responseBody;
}

export async function verifyAndSettle(header, config) {
  const payload = decodePaymentHeader(header);
  const request = payload.authorization
    ? { ...payload, network: config.network }
    : { authorization: payload, network: config.network };
  const verify = await postJson(
    `${config.facilitatorUrl}/v2/verify`,
    request,
    config.facilitatorTimeoutMs,
  );
  if (!verify?.isValid) throw new Error("Payment authorization is invalid");
  return postJson(
    `${config.facilitatorUrl}/v2/settle`,
    request,
    config.facilitatorTimeoutMs,
  );
}
