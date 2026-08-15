# Aisle

Agentic Storefront Protocol: merchants talk, agents pay — **Avalanche x402**, **StraitsX** scoped cards, **AWS** Bedrock + serverless protocol.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000/demo](http://localhost:3000/demo) → **Run full 90s script**.

Seed store: `/s/hackathon-shirts/llms.txt`

## 90-second pitch (say the three names)

1. **Merchant (15s)** — “Aisle is Shopify for AI agents. Merchant types inventory in XSGD; we publish `llms.txt` + ACP catalog. No human checkout UI.”
2. **Avalanche (30s)** — Click **Buy via x402** (or full script). Terminal goes **red HTTP 402** → agent transfers XSGD on Avalanche → **green 200** + **Snowtrace** link on the receipt. That is Best Use of x402.
3. **StraitsX (25s)** — Same demo, **StraitsX card rail**: one-time card with spend cap = SKU, merchant whitelist, short TTL, then burn. Agentic payments without leaking a standing credential.
4. **AWS (20s)** — Agents optionally run on **Bedrock Converse + tools** (deterministic fallback if Bedrock is down). Protocol deploys as **API Gateway + Lambda + DynamoDB + CloudWatch 402→200** — Well-Architected slice, not the giant Bedrock shopping CDK. Dashboard shows both rails.

Judges open: `/demo` log, Snowtrace URL, `/dashboard` (x402 + StraitsX rows), CloudWatch dashboard after `npm run protocol:deploy`.

## Env

| Var | Purpose |
|---|---|
| `MERCHANT_ADDRESS` / `BUYER_PRIVATE_KEY` | Avalanche x402 settlement |
| `STRAITSX_MCP_URL` | Card MCP (`…/sandbox/sse` or production) |
| `BEDROCK_ENABLED` | Default on; set `false` to force deterministic agents |
| `BEDROCK_MODEL_ID` / `AWS_REGION` | Bedrock Converse |
| `PROTOCOL_BASE_URL` / `AISLE_TABLE` | After AWS protocol deploy |

Without `BUYER_PRIVATE_KEY`, **402 still fires** (prize visual). Settlement needs funded XSGD.

## AWS protocol deploy

```bash
export AWS_REGION=ap-southeast-1 MERCHANT_ADDRESS=0xYourMerchant
npm run protocol:deploy
# paste PROTOCOL_BASE_URL + AISLE_TABLE into .env
```

See `infra/protocol.yaml` — throttle, SSM, DynamoDB, CloudWatch metric filters + alarm. Delete the stack after the hackathon.
