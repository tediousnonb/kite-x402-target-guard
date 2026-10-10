# Kite x402 Target Guard

An original, dependency-free x402 service that evaluates a paid HTTP target
before an AI agent sends funds. It is designed for Kite Agent Passport service
providers and agent builders who need a deterministic safety decision instead
of trusting a URL and 402 payload at face value.

## Why it exists

x402 clients receive payment instructions from arbitrary HTTP services. A
malicious or misconfigured challenge can redirect the resource, request an
unexpected token, overcharge the agent, or resolve to an internal address.
Target Guard validates those conditions and returns structured findings before
the caller continues.

## Checks

- HTTPS-only targets and standard ports;
- DNS resolution with private, loopback, link-local and reserved IP blocking;
- URL credential and local-hostname rejection;
- exact `resource` binding to the requested URL;
- Kite testnet, `gokite-aa` and PIEUSD allowlisting;
- maximum atomic payment amount and timeout;
- non-zero EVM payee validation;
- fail-closed behavior for malformed challenges and DNS errors.

## Run locally

Node.js 20 or newer is required. There are no runtime dependencies.

```bash
npm install
npm test
npm run check
npm run dev
```

Local development disables payment settlement. Submit an evaluation:

```bash
curl -X POST http://localhost:8787/v1/evaluate \
  -H 'content-type: application/json' \
  --data @docs/example-request.json
```

## Production x402 mode

Copy `.env.example` into your deployment secret configuration and set a real
`PAYEE_WALLET` plus the public service origin. Never commit private keys; the
service only needs a payee address.

Without `X-PAYMENT`, `POST /v1/evaluate` returns a Kite testnet 402 challenge.
With a payment header, the service verifies and settles through the configured
facilitator before evaluating the target.

```bash
PAYEE_WALLET=0xYourWallet \
PUBLIC_BASE_URL=https://guard.example \
npm start
```

The default payment asset is Kite testnet PIEUSD:
`0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63`.

## API

- `GET /health` — deployment and payment-mode health.
- `POST /v1/evaluate` — paid target evaluation.

The OpenAPI document is available at [`docs/openapi.yaml`](docs/openapi.yaml).

## Scope

Target Guard is a preflight policy service, not a replacement for wallet
simulation, facilitator verification, DNS pinning at connection time, or Kite's
executable service catalog. Operators should re-resolve and pin approved IPs in
the component that performs the final HTTP request.
