export function serviceDocument(config, resource) {
  return {
    name: "kite-x402-target-guard",
    displayName: "Kite x402 Target Guard",
    version: "0.2.0",
    description: "Preflight security analysis for x402 payment targets on Kite.",
    homepage: config.publicBaseUrl ?? null,
    capabilities: [
      "x402-challenge-analysis",
      "dns-ssrf-protection",
      "payment-policy-enforcement",
      "privacy-safe-audit-log",
    ],
    endpoint: {
      method: "POST",
      url: resource,
      paymentRequired: !config.paymentDisabled,
      contentType: "application/json",
    },
    payment: {
      protocol: "x402",
      versions: [1, 2],
      scheme: "gokite-aa",
      network: config.network,
      asset: config.asset,
      amount: config.amount,
      payTo: config.paymentDisabled ? null : config.payTo,
      facilitator: config.facilitatorUrl,
    },
    links: {
      health: "/health",
      audits: "/v1/audits",
      openapi: "/openapi.yaml",
    },
  };
}
