const MAX_HEADER_SIZE = 64 * 1024;

function decodeBase64Json(value) {
  if (value.length > MAX_HEADER_SIZE) throw new Error("Challenge header exceeds 64 KiB");
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("Challenge header is not valid base64 JSON");
  }
}

function canonicalNetwork(value) {
  if (value === "eip155:2368") return "kite-testnet";
  return value;
}

function normalizeOffer(offer, fallbackResource) {
  if (!offer || typeof offer !== "object" || Array.isArray(offer)) return offer;
  return {
    ...offer,
    scheme: offer.scheme === "exact" ? "gokite-aa" : offer.scheme,
    network: canonicalNetwork(offer.network),
    maxAmountRequired: offer.maxAmountRequired ?? offer.amount,
    resource: offer.resource ?? fallbackResource,
  };
}

export function parseChallenge(value, requestedUrl) {
  let challenge = value;
  if (typeof challenge === "string") challenge = decodeBase64Json(challenge.trim());
  if (challenge?.paymentRequired) challenge = challenge.paymentRequired;
  if (!challenge || typeof challenge !== "object" || Array.isArray(challenge)) {
    throw new Error("challenge must be an object or base64 JSON header");
  }

  const version = challenge.x402Version ?? challenge.version;
  const accepts = Array.isArray(challenge.accepts)
    ? challenge.accepts.map((offer) => normalizeOffer(offer, requestedUrl))
    : [];
  return { ...challenge, x402Version: version, accepts };
}
