import { createPolicy, KITE_TESTNET_PIEUSD } from "./policy.mjs";

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

function integer(value, fallback, name, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function origin(value) {
  if (!value) return undefined;
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("PUBLIC_BASE_URL must use HTTPS outside localhost");
  }
  return parsed.origin;
}

export function loadConfig(environment = process.env) {
  const paymentDisabled = environment.PAYMENT_DISABLED === "true";
  const payTo = environment.PAYEE_WALLET ?? "0x0000000000000000000000000000000000000000";
  const asset = environment.PAYMENT_ASSET ?? KITE_TESTNET_PIEUSD;
  const amount = environment.PAYMENT_AMOUNT ?? "10000";

  if (!paymentDisabled && (!ADDRESS.test(payTo) || /^0x0{40}$/.test(payTo))) {
    throw new Error("PAYEE_WALLET must be a non-zero EVM address in paid mode");
  }
  if (!ADDRESS.test(asset)) throw new Error("PAYMENT_ASSET must be an EVM address");
  if (!/^\d+$/.test(amount) || BigInt(amount) < 1n) {
    throw new Error("PAYMENT_AMOUNT must be a positive integer string");
  }

  const csv = (value) => value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
  return Object.freeze({
    port: integer(environment.PORT, 8787, "PORT", { max: 65_535 }),
    payTo,
    asset,
    amount,
    network: environment.PASSPORT_NETWORK ?? "kite-testnet",
    facilitatorUrl: (environment.FACILITATOR_URL ?? "https://facilitator.pieverse.io").replace(/\/$/, ""),
    facilitatorTimeoutMs: integer(
      environment.FACILITATOR_TIMEOUT_MS,
      10_000,
      "FACILITATOR_TIMEOUT_MS",
      { max: 60_000 },
    ),
    paymentDisabled,
    publicBaseUrl: origin(environment.PUBLIC_BASE_URL),
    policy: createPolicy({
      maxAmount: BigInt(environment.MAX_TARGET_PAYMENT ?? "1000000"),
      allowedHosts: csv(environment.ALLOWED_TARGET_HOSTS),
      blockedHosts: csv(environment.BLOCKED_TARGET_HOSTS),
    }),
  });
}
