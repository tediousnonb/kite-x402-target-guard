/**
 * Reputation scoring and risk classification engine for evaluated targets
 */

export const RISK_LEVELS = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
});

export class ReputationEngine {
  #targetScores = new Map();
  #maxHistoryPerHost;

  constructor(maxHistoryPerHost = 100) {
    this.#maxHistoryPerHost = maxHistoryPerHost;
  }

  /**
   * Records a security decision outcome and adjusts target reputation
   */
  recordEvaluation({ hostname, allowed, score, findingCodes = [] }) {
    if (!hostname || typeof hostname !== "string") {
      throw new Error("hostname must be a non-empty string");
    }

    const host = hostname.toLowerCase();
    const existing = this.#targetScores.get(host) ?? {
      totalEvaluations: 0,
      passedEvaluations: 0,
      blockedEvaluations: 0,
      recentScores: [],
      findingFrequency: new Map(),
      lastEvaluatedAt: null,
    };

    existing.totalEvaluations += 1;
    if (allowed) {
      existing.passedEvaluations += 1;
    } else {
      existing.blockedEvaluations += 1;
    }

    existing.recentScores.unshift(Number(score));
    if (existing.recentScores.length > this.#maxHistoryPerHost) {
      existing.recentScores.length = this.#maxHistoryPerHost;
    }

    for (const code of findingCodes) {
      existing.findingFrequency.set(code, (existing.findingFrequency.get(code) ?? 0) + 1);
    }

    existing.lastEvaluatedAt = new Date().toISOString();
    this.#targetScores.set(host, existing);

    return this.getProfile(host);
  }

  /**
   * Computes risk profile and reputation metrics for a target host
   */
  getProfile(hostname) {
    const host = hostname.toLowerCase();
    const stats = this.#targetScores.get(host);
    if (!stats) {
      return {
        hostname: host,
        reputationScore: 100,
        riskLevel: RISK_LEVELS.LOW,
        totalEvaluations: 0,
        passRate: 1.0,
        trusted: false,
      };
    }

    const avgRecentScore = stats.recentScores.length
      ? stats.recentScores.reduce((acc, s) => acc + s, 0) / stats.recentScores.length
      : 100;

    const passRate = stats.totalEvaluations > 0 ? stats.passedEvaluations / stats.totalEvaluations : 1.0;
    const reputationScore = Math.round(avgRecentScore * passRate);

    let riskLevel = RISK_LEVELS.LOW;
    if (reputationScore < 40 || stats.blockedEvaluations >= 5) {
      riskLevel = RISK_LEVELS.CRITICAL;
    } else if (reputationScore < 70) {
      riskLevel = RISK_LEVELS.HIGH;
    } else if (reputationScore < 90) {
      riskLevel = RISK_LEVELS.MEDIUM;
    }

    const trusted = stats.totalEvaluations >= 3 && stats.blockedEvaluations === 0 && reputationScore >= 95;

    return {
      hostname: host,
      reputationScore,
      riskLevel,
      totalEvaluations: stats.totalEvaluations,
      passRate: Number(passRate.toFixed(4)),
      trusted,
      lastEvaluatedAt: stats.lastEvaluatedAt,
    };
  }

  /**
   * Resets reputation record for host (operator administrative action)
   */
  reset(hostname) {
    const host = hostname.toLowerCase();
    return this.#targetScores.delete(host);
  }
}
