# Kite x402 Target Guard

Target Guard is an original x402 security service for Kite Agent Passport. It
evaluates a paid HTTP target before an autonomous agent authorizes funds. The
repository includes a responsive web console, machine-readable discovery,
Kite payment handling, privacy-safe decision history, metrics and a complete
test suite.

## Product capabilities

- Interactive browser console for JSON and base64 `PAYMENT-REQUIRED` data.
- x402 v1 and v2 challenge normalization for Kite testnet.
- DNS-based SSRF defense across IPv4, IPv6 and mapped addresses.
- Exact resource binding and URL credential/port/hostname enforcement.
- Network, scheme, PIEUSD asset, amount, timeout and payee policy checks.
- Optional host allowlists and denylists for controlled deployments.
- Kite facilitator verification and settlement in paid mode.
- Machine discovery at `/.well-known/x402` and `/v1/service`.
- Bounded audit history, request tracing and Prometheus metrics.
- Dependency-free Node.js runtime, Docker image and end-to-end tests.

## Quick start

Node.js 20 or newer is required.

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:8787` to use the security console. Development mode is
free so the full workflow can be evaluated without a wallet.

```bash
curl -X POST http://localhost:8787/v1/evaluate \
  -H 'content-type: application/json' \
  --data @docs/example-request.json
```

An executable agent example is included:

```bash
node examples/agent-client.mjs
```

## Production x402 mode

Copy `.env.example` into the secret configuration of your hosting platform.
Set a real `PAYEE_WALLET` and `PUBLIC_BASE_URL`; never commit a private key.
The service only needs the public payee address.

```bash
PAYEE_WALLET=0xYourWallet \
PUBLIC_BASE_URL=https://guard.example \
npm start
```

Without `X-PAYMENT`, `POST /v1/evaluate` returns a Kite testnet x402 challenge.
With a payment authorization, Target Guard verifies and settles through the
configured facilitator, evaluates the destination and returns the receipt.

Default network values:

| Setting | Value |
| --- | --- |
| Network | `kite-testnet` / `eip155:2368` |
| Scheme | `gokite-aa` (`exact` v2 input is normalized) |
| Asset | PIEUSD `0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63` |
| Facilitator | `https://facilitator.pieverse.io` |

## HTTP surface

| Route | Purpose |
| --- | --- |
| `GET /` | Interactive security console |
| `GET /health` | Runtime and payment-mode health |
| `GET /.well-known/x402` | Machine-readable x402 discovery |
| `POST /v1/evaluate` | Paid target evaluation |
| `GET /v1/audits` | Recent privacy-safe decision records |
| `GET /metrics` | Prometheus-compatible process metrics |

See [OpenAPI](docs/openapi.yaml) and [architecture](docs/ARCHITECTURE.md) for
the detailed protocol and security boundaries.

## Docker

```bash
docker compose up --build
```

The production image runs as an unprivileged user and includes a container
health check. Replace `PAYMENT_DISABLED=true` in `compose.yaml` with deployment
secrets before enabling paid mode.

## Quality gates

```bash
npm run check
npm test
docker build -t kite-x402-target-guard .
```

CI runs syntax checks, unit and end-to-end HTTP tests, and a production image
build on every push and pull request.

## Scope

Target Guard is a preflight policy service, not a wallet simulator, DNS pinning
proxy, or replacement for Kite's executable service catalog. The component
that performs the final target request must independently re-resolve and pin
the approved destination.

## License

MIT
