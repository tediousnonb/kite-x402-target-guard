const endpoint = process.env.GUARD_URL ?? "http://localhost:8787/v1/evaluate";
const target = "https://merchant.example/v1/weather?city=shanghai";

const challenge = {
  x402Version: 2,
  accepts: [{
    scheme: "exact",
    network: "eip155:2368",
    amount: "10000",
    resource: target,
    asset: "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63",
    payTo: "0x1111111111111111111111111111111111111111",
    maxTimeoutSeconds: 60,
  }],
};

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url: target, challenge }),
});
const body = await response.json();
console.log(JSON.stringify(body, null, 2));
process.exitCode = body.result?.allowed ? 0 : 1;
