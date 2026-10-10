import { randomUUID } from "node:crypto";

export class AuditLog {
  #entries = [];
  #capacity;

  constructor(capacity = 200) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error("capacity must be positive");
    this.#capacity = capacity;
  }

  append({ result, mode, receipt = null }) {
    const entry = Object.freeze({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      allowed: result.allowed,
      score: result.score,
      hostname: result.target?.hostname ?? null,
      findingCodes: result.findings.map((item) => item.code),
      network: result.selectedOffer?.network ?? null,
      amount: result.selectedOffer?.amount ?? null,
      mode,
      settlementTransaction:
        receipt?.transaction ?? receipt?.txHash ?? receipt?.transactionHash ?? null,
    });
    this.#entries.unshift(entry);
    if (this.#entries.length > this.#capacity) this.#entries.length = this.#capacity;
    return entry;
  }

  list({ limit = 50, allowed } = {}) {
    const filtered = typeof allowed === "boolean"
      ? this.#entries.filter((entry) => entry.allowed === allowed)
      : this.#entries;
    return filtered.slice(0, Math.min(Math.max(limit, 1), 100));
  }

  get size() {
    return this.#entries.length;
  }
}
