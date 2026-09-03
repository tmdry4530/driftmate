---
name: driftmate
description: Review a DriftMate vault session, explain its on-chain decision and approval state, and add clearly separated read-only Binance Agent OS market context. Use for DriftMate status, pending approvals, session loss, or track-record questions. Never use it to place trades, transfer funds, approve vault actions, or generate execution parameters.
metadata:
  author: tmdry4530
  version: "1.0.0"
license: MIT
---

# DriftMate

Explain what the existing DriftMate agent did and why. Keep Binance market observations separate from DriftMate's deterministic on-chain evidence.

## Read the session

Use the full `GET /status` endpoint supplied by the user or `DRIFTMATE_STATUS_URL`. For local development, default to `http://127.0.0.1:8945/status`.

```bash
curl --fail --silent --show-error --max-time 5 "${DRIFTMATE_STATUS_URL:-http://127.0.0.1:8945/status}"
```

Accept only a JSON object whose `phase` is `idle`, `deciding`, or `awaiting_approval` and whose identifiers are correctly shaped. Never try another DriftMate route or HTTP method. If the response is unavailable or malformed, say that the session cannot be verified and stop; do not infer its state.

## Add Binance Agent OS context

If the target token is unambiguous, use one available read-only Binance source:

1. the connected Binance MCP Server with **Market data** scope, or
2. the official `query-token-info` skill's `dynamic` command.

Prefer chain ID plus contract address over a symbol. If only a symbol is available and it maps to multiple tokens, ask for the chain and contract address. State the Binance source and observation time. If no Binance tool is available, keep the verified DriftMate summary and label market context unavailable.

Binance data is contextual evidence only. Never use it to change or recommend DriftMate target weights, trade direction, amount, minimum output, thresholds, or delegation settings.

## Present the result

Use this order:

1. verified delegation ID and config hash;
2. current DriftMate phase and the on-chain decision or loss evidence;
3. separately labeled Binance market context;
4. whether the owner needs to inspect the DriftMate web app.

For an open pending item, report its amount, cap source, overage, direction, and expiry. Do not recommend approval or rejection. Direct the owner to review and sign in the DriftMate web app.

## Hard boundaries

- Do not call Binance Trade, Transfer, Convert, Futures, Margin, wallet-write, or account-write tools.
- Do not submit a contract transaction or approve, reject, expire, finalize, revoke, deposit, or withdraw.
- Do not request API keys, private keys, seed phrases, or an MCP endpoint in chat.
- Do not predict prices, promise returns, or give buy/sell advice.
- If a user asks for a write action, explain that DriftMate requires the owner wallet's direct confirmation in its web app.
