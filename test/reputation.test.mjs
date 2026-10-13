import test from "node:test";
import assert from "node:assert/strict";
import { ReputationEngine, RISK_LEVELS } from "../src/reputation.mjs";

test("defaults to neutral low-risk profile for unseen host", () => {
  const engine = new ReputationEngine();
  const profile = engine.getProfile("api.example.com");

  assert.equal(profile.reputationScore, 100);
  assert.equal(profile.riskLevel, RISK_LEVELS.LOW);
  assert.equal(profile.totalEvaluations, 0);
  assert.equal(profile.trusted, false);
});

test("marks clean consecutive evaluations as trusted", () => {
  const engine = new ReputationEngine();
  for (let i = 0; i < 3; i++) {
    engine.recordEvaluation({
      hostname: "api.kite.ai",
      allowed: true,
      score: 100,
      findingCodes: [],
    });
  }

  const profile = engine.getProfile("api.kite.ai");
  assert.equal(profile.totalEvaluations, 3);
  assert.equal(profile.passRate, 1.0);
  assert.equal(profile.trusted, true);
  assert.equal(profile.riskLevel, RISK_LEVELS.LOW);
});

test("degrades reputation score and escalates risk upon security blocks", () => {
  const engine = new ReputationEngine();
  // 1 passed evaluation
  engine.recordEvaluation({
    hostname: "malicious-target.com",
    allowed: true,
    score: 80,
  });

  // Multiple blocked attempts with SSRF or malicious finding
  for (let i = 0; i < 5; i++) {
    engine.recordEvaluation({
      hostname: "malicious-target.com",
      allowed: false,
      score: 10,
      findingCodes: ["SSRF_PRIVATE_IP_BLOCKED"],
    });
  }

  const profile = engine.getProfile("malicious-target.com");
  assert.equal(profile.totalEvaluations, 6);
  assert.equal(profile.trusted, false);
  assert.equal(profile.riskLevel, RISK_LEVELS.CRITICAL);
  assert.ok(profile.reputationScore < 40);
});

test("allows operator to reset target profile", () => {
  const engine = new ReputationEngine();
  engine.recordEvaluation({
    hostname: "reset-me.com",
    allowed: false,
    score: 0,
  });
  assert.equal(engine.getProfile("reset-me.com").totalEvaluations, 1);

  engine.reset("reset-me.com");
  assert.equal(engine.getProfile("reset-me.com").totalEvaluations, 0);
});
