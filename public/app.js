const PIEUSD = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";
const TARGET = "https://merchant.example/v1/weather?city=shanghai";
const sample = {
  x402Version: 2,
  accepts: [{
    scheme: "exact",
    network: "eip155:2368",
    amount: "10000",
    resource: TARGET,
    asset: PIEUSD,
    payTo: "0x1111111111111111111111111111111111111111",
    maxTimeoutSeconds: 60,
  }],
};

const byId = (id) => document.getElementById(id);
const elements = {
  url: byId("target-url"),
  challenge: byId("challenge"),
  submit: byId("evaluate-button"),
  message: byId("form-message"),
  badge: byId("decision-badge"),
  empty: byId("empty-result"),
  content: byId("result-content"),
  score: byId("risk-score"),
  host: byId("result-host"),
  network: byId("result-network"),
  amount: byId("result-amount"),
  addresses: byId("result-addresses"),
  findings: byId("finding-list"),
  history: byId("history-list"),
};

function setSample() {
  elements.url.value = TARGET;
  elements.challenge.value = JSON.stringify(sample, null, 2);
  elements.message.textContent = "Sample loaded. Change any field to test a blocked decision.";
}

function renderResult(result) {
  elements.empty.hidden = true;
  elements.content.hidden = false;
  elements.score.textContent = result.score;
  elements.host.textContent = result.target?.hostname ?? "Invalid target";
  elements.network.textContent = result.selectedOffer?.network ?? "—";
  elements.amount.textContent = result.selectedOffer?.amount ?? "—";
  elements.addresses.textContent = result.resolvedAddresses.join(", ") || "None";
  elements.badge.textContent = result.allowed ? "Payment target allowed" : "Payment blocked";
  elements.badge.className = `badge ${result.allowed ? "allowed" : "blocked"}`;
  elements.findings.replaceChildren();
  const findings = result.findings.length
    ? result.findings
    : [{ code: "POLICY_PASS", message: "All configured checks passed." }];
  for (const finding of findings) {
    const item = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = finding.code;
    item.append(code, document.createTextNode(finding.message));
    elements.findings.append(item);
  }
}

async function evaluate() {
  elements.message.textContent = "";
  elements.submit.disabled = true;
  try {
    const challengeText = elements.challenge.value.trim();
    let challenge = challengeText;
    if (challengeText.startsWith("{")) challenge = JSON.parse(challengeText);
    const response = await fetch("/v1/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: elements.url.value.trim(), challenge }),
    });
    const body = await response.json();
    if (response.status === 402) {
      throw new Error("This deployment requires x402 payment. Use an x402 client with the returned challenge.");
    }
    if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
    renderResult(body.result);
    await loadHistory();
  } catch (error) {
    elements.message.textContent = error instanceof Error ? error.message : "Evaluation failed";
  } finally {
    elements.submit.disabled = false;
  }
}

async function loadHistory() {
  try {
    const response = await fetch("/v1/audits?limit=10");
    const { entries } = await response.json();
    elements.history.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.textContent = "No decisions recorded in this process yet.";
      elements.history.append(empty);
      return;
    }
    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = "history-row";
      const time = document.createElement("time");
      time.textContent = new Date(entry.createdAt).toLocaleTimeString();
      const host = document.createElement("span");
      host.textContent = entry.hostname ?? "invalid target";
      const decision = document.createElement("strong");
      decision.className = entry.allowed ? "allowed" : "blocked";
      decision.textContent = entry.allowed ? "ALLOWED" : "BLOCKED";
      const score = document.createElement("small");
      score.textContent = `risk ${entry.score}`;
      row.append(time, host, decision, score);
      elements.history.append(row);
    }
  } catch {
    elements.history.textContent = "History is temporarily unavailable.";
  }
}

byId("sample-button").addEventListener("click", setSample);
elements.submit.addEventListener("click", evaluate);
byId("refresh-history").addEventListener("click", loadHistory);
setSample();
loadHistory();
