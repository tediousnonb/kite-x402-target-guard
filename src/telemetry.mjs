export class Telemetry {
  #startedAt = Date.now();
  #requests = 0;
  #responses = new Map();
  #totalDurationMs = 0;

  observe(statusCode, durationMs) {
    this.#requests += 1;
    this.#responses.set(statusCode, (this.#responses.get(statusCode) ?? 0) + 1);
    this.#totalDurationMs += durationMs;
  }

  snapshot() {
    return {
      uptimeSeconds: Math.floor((Date.now() - this.#startedAt) / 1000),
      requests: this.#requests,
      responses: Object.fromEntries(this.#responses),
      averageDurationMs: this.#requests ? this.#totalDurationMs / this.#requests : 0,
    };
  }

  prometheus() {
    const snapshot = this.snapshot();
    const statuses = Object.entries(snapshot.responses)
      .map(([status, count]) => `target_guard_http_responses_total{status="${status}"} ${count}`)
      .join("\n");
    return [
      "# HELP target_guard_http_requests_total Total HTTP requests.",
      "# TYPE target_guard_http_requests_total counter",
      `target_guard_http_requests_total ${snapshot.requests}`,
      "# HELP target_guard_uptime_seconds Process uptime.",
      "# TYPE target_guard_uptime_seconds gauge",
      `target_guard_uptime_seconds ${snapshot.uptimeSeconds}`,
      statuses,
      "",
    ].filter((line) => line !== "").join("\n") + "\n";
  }
}
