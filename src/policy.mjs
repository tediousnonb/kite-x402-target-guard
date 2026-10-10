import { isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";

export const KITE_TESTNET_PIEUSD =
  "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";

export const defaultPolicy = Object.freeze({
  allowedNetworks: ["kite-testnet"],
  allowedAssets: [KITE_TESTNET_PIEUSD],
  allowedSchemes: ["gokite-aa"],
  maxAmount: 1_000_000n,
  maxTimeoutSeconds: 300,
  requireHttps: true,
  requireExactResource: true,
  allowedHosts: [],
  blockedHosts: [],
});

export function createPolicy(overrides = {}) {
  return Object.freeze({
    ...defaultPolicy,
    ...overrides,
    allowedNetworks: [...(overrides.allowedNetworks ?? defaultPolicy.allowedNetworks)],
    allowedAssets: [...(overrides.allowedAssets ?? defaultPolicy.allowedAssets)],
    allowedSchemes: [...(overrides.allowedSchemes ?? defaultPolicy.allowedSchemes)],
    allowedHosts: [...(overrides.allowedHosts ?? defaultPolicy.allowedHosts)],
    blockedHosts: [...(overrides.blockedHosts ?? defaultPolicy.blockedHosts)],
  });
}

function hostMatches(hostname, rule) {
  const normalized = rule.toLowerCase().replace(/^\*\./, "");
  return hostname === normalized || hostname.endsWith(`.${normalized}`);
}

function finding(code, severity, message) {
  return { code, severity, message };
}

function isBlockedIpv4(address) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return true;
  }
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

export function isBlockedAddress(address) {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version !== 6) return true;

  const normalized = address.toLowerCase();
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  ) {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return isIP(mapped) === 4 ? isBlockedIpv4(mapped) : true;
  }
  return false;
}

async function resolveAddresses(hostname, resolver) {
  if (isIP(hostname)) return [hostname];
  const records = await resolver(hostname);
  return records.map((record) =>
    typeof record === "string" ? record : record.address,
  );
}

function selectOffer(challenge, policy) {
  if (!challenge || typeof challenge !== "object" || Array.isArray(challenge)) {
    return null;
  }
  if (!Array.isArray(challenge.accepts)) return null;
  return (
    challenge.accepts.find(
      (offer) =>
        offer &&
        typeof offer === "object" &&
        policy.allowedNetworks.includes(offer.network),
    ) ?? challenge.accepts[0] ?? null
  );
}

function inspectOffer(offer, target, policy) {
  const findings = [];
  if (!offer || typeof offer !== "object" || Array.isArray(offer)) {
    return [finding("OFFER_MISSING", "block", "No usable payment offer found")];
  }

  if (!policy.allowedSchemes.includes(offer.scheme)) {
    findings.push(
      finding("SCHEME_UNSUPPORTED", "block", `Unsupported scheme: ${offer.scheme}`),
    );
  }
  if (!policy.allowedNetworks.includes(offer.network)) {
    findings.push(
      finding("NETWORK_UNSUPPORTED", "block", `Unsupported network: ${offer.network}`),
    );
  }
  if (
    typeof offer.asset !== "string" ||
    !policy.allowedAssets.some(
      (asset) => asset.toLowerCase() === offer.asset.toLowerCase(),
    )
  ) {
    findings.push(
      finding("ASSET_UNSUPPORTED", "block", "Payment asset is not allowlisted"),
    );
  }

  if (typeof offer.maxAmountRequired !== "string" || !/^\d+$/.test(offer.maxAmountRequired)) {
    findings.push(
      finding("AMOUNT_INVALID", "block", "Payment amount must be an integer string"),
    );
  } else if (BigInt(offer.maxAmountRequired) > policy.maxAmount) {
    findings.push(
      finding(
        "AMOUNT_EXCEEDS_LIMIT",
        "block",
        `Payment amount exceeds policy limit ${policy.maxAmount}`,
      ),
    );
  }

  if (
    typeof offer.payTo !== "string" ||
    !/^0x[a-fA-F0-9]{40}$/.test(offer.payTo) ||
    /^0x0{40}$/.test(offer.payTo)
  ) {
    findings.push(
      finding("PAYEE_INVALID", "block", "Payee must be a non-zero EVM address"),
    );
  }

  if (
    !Number.isInteger(offer.maxTimeoutSeconds) ||
    offer.maxTimeoutSeconds < 1 ||
    offer.maxTimeoutSeconds > policy.maxTimeoutSeconds
  ) {
    findings.push(
      finding("TIMEOUT_INVALID", "block", "Payment timeout is outside policy"),
    );
  }

  try {
    const resource = new URL(offer.resource);
    if (policy.requireExactResource && resource.href !== target.href) {
      findings.push(
        finding(
          "RESOURCE_MISMATCH",
          "block",
          "Payment resource does not exactly match the requested URL",
        ),
      );
    } else if (resource.origin !== target.origin) {
      findings.push(
        finding("RESOURCE_ORIGIN_MISMATCH", "block", "Payment resource origin differs"),
      );
    }
  } catch {
    findings.push(
      finding("RESOURCE_INVALID", "block", "Payment resource is not a valid URL"),
    );
  }

  return findings;
}

export async function evaluateTarget(
  input,
  policy = defaultPolicy,
  resolver = (hostname) => dnsLookup(hostname, { all: true, verbatim: true }),
) {
  const findings = [];
  let target;
  try {
    target = new URL(input.url);
  } catch {
    return {
      allowed: false,
      score: 100,
      findings: [finding("URL_INVALID", "block", "Target URL is invalid")],
      target: null,
      resolvedAddresses: [],
    };
  }

  if (policy.requireHttps && target.protocol !== "https:") {
    findings.push(finding("HTTPS_REQUIRED", "block", "Target must use HTTPS"));
  }
  if (target.username || target.password) {
    findings.push(
      finding("URL_CREDENTIALS", "block", "Credentials in target URLs are forbidden"),
    );
  }
  if (target.hash) {
    findings.push(
      finding("URL_FRAGMENT", "warning", "URL fragments are not sent to the service"),
    );
  }
  if (target.port && target.port !== "443") {
    findings.push(
      finding("PORT_UNUSUAL", "block", "Only the standard HTTPS port is allowed"),
    );
  }
  if (
    target.hostname === "localhost" ||
    target.hostname.endsWith(".localhost") ||
    target.hostname.endsWith(".local") ||
    target.hostname.endsWith(".internal")
  ) {
    findings.push(
      finding("LOCAL_HOSTNAME", "block", "Local hostnames are forbidden"),
    );
  }
  if (policy.blockedHosts.some((rule) => hostMatches(target.hostname, rule))) {
    findings.push(finding("HOST_BLOCKED", "block", "Target host is explicitly blocked"));
  }
  if (
    policy.allowedHosts.length > 0 &&
    !policy.allowedHosts.some((rule) => hostMatches(target.hostname, rule))
  ) {
    findings.push(finding("HOST_NOT_ALLOWED", "block", "Target host is outside the allowlist"));
  }

  let resolvedAddresses = [];
  try {
    resolvedAddresses = [...new Set(await resolveAddresses(target.hostname, resolver))];
    if (!resolvedAddresses.length) {
      findings.push(finding("DNS_EMPTY", "block", "Target has no DNS addresses"));
    }
    for (const address of resolvedAddresses) {
      if (isBlockedAddress(address)) {
        findings.push(
          finding(
            "PRIVATE_ADDRESS",
            "block",
            `Target resolves to a private or reserved address: ${address}`,
          ),
        );
      }
    }
  } catch {
    findings.push(finding("DNS_FAILURE", "block", "Target DNS resolution failed"));
  }

  if (![1, 2].includes(input.challenge?.x402Version)) {
    findings.push(
      finding("X402_VERSION", "block", "Only x402 versions 1 and 2 are supported"),
    );
  }
  const offer = selectOffer(input.challenge, policy);
  findings.push(...inspectOffer(offer, target, policy));

  const score = Math.min(
    100,
    findings.reduce(
      (total, item) => total + (item.severity === "block" ? 40 : 10),
      0,
    ),
  );
  return {
    allowed: !findings.some((item) => item.severity === "block"),
    score,
    findings,
    target: {
      origin: target.origin,
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
    },
    resolvedAddresses,
    selectedOffer: offer
      ? {
          scheme: offer.scheme,
          network: offer.network,
          asset: offer.asset,
          amount: offer.maxAmountRequired,
          payTo: offer.payTo,
        }
      : null,
  };
}
