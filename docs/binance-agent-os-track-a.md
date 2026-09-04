# Binance Agent OS Mini Hackathon — Track A Submission Guide

## Selected track

Submit to **Track A: Build AI Agents with Agent OS**.

DriftMate already provides a complete agent flow with deterministic decisions, bounded delegation, direct owner approval, an on-chain track record, and character-based explanations. Combining Binance Agent OS market context with DriftMate's verifiable permission boundary fits the product and its safety contract better than adding a separate Binance execution path for Track B trading volume.

Submission message:

> Binance Agent OS connects the market. DriftMate proves when an agent is allowed to act.

Submission links:

- Public repository: <https://github.com/tmdry4530/driftmate/tree/hackathon/binance-agent-os>
- 71-second demo: <https://github.com/tmdry4530/driftmate/releases/download/hackathon-binance-agent-os-v1/driftmate-binance-agent-os-track-a.mp4>

## Connect Agent OS

1. Install the official Binance Skills Hub market-data skill.

   ```bash
   npx skills add https://github.com/binance/binance-skills-hub --skill query-token-info -y
   ```

2. Install this repository's `driftmate` skill in the project agent.

   ```bash
   npx skills add . --skill driftmate -y
   ```

3. Follow the [official Binance MCP connection guide](https://developers.binance.com/en/docs/agent-native/mcp-server/agentic) in a supported client and authorize **Market data only**. Never paste endpoints or credentials into chat.

The `query-token-info` skill can use the official Skills Hub public market-data path without MCP OAuth. Neither connection is part of DriftMate's order or approval path.

## Run the local demo

Install dependencies and run the complete verification suite first.

```bash
pnpm install --frozen-lockfile
# Run once in a fresh clone
pnpm contracts:setup
pnpm test
pnpm typecheck
pnpm contracts:test
pnpm --filter @soon/web build
pnpm e2e
```

Run the demo in two terminals. The first command keeps Anvil and the keeper running and generates `apps/web/.env`.

```bash
KEEP=1 pnpm e2e
```

```bash
pnpm -C apps/web dev
```

Example local-agent prompt:

```text
Use DriftMate to review the current session at http://127.0.0.1:8945/status.
Add Binance Agent OS market context for BNB on BSC, but keep it separate because
the local E2E asset is a mock token. Do not trade, transfer, or approve anything.
```

## Three-minute demo flow

1. **0:00–0:25 — Problem:** Explain why verifying what an AI can do matters more than another trading recommendation.
2. **0:25–0:55 — Character delegation:** Show each character's fixed strategy and the owner-signed assets, DEX, duration, caps, and budget.
3. **0:55–1:25 — Automatic execution:** Show a small rebalance and the on-chain `Decided`, `Executed`, and cost records.
4. **1:25–1:55 — Approval boundary:** Show an over-limit order stopping until the owner wallet—not Agent OS—approves it directly.
5. **1:55–2:25 — Agent OS:** Show the `driftmate` skill explaining `/status` and Binance market data in separate sections.
6. **2:25–2:50 — Loss and trust:** Show the session baseline, P&L after operating costs, and reduced discretion after an owner disappointment signal.
7. **2:50–3:00 — Close:** End with “connected by Binance, constrained by code, verified on-chain.”

## Pre-submission checklist

- [ ] Repository URL and demo video URL under three minutes are ready.
- [ ] `skills/driftmate/SKILL.md` is visible in the repository.
- [ ] A Binance MCP or `query-token-info` call is visible in the video.
- [ ] The demo explains that Binance data is separate from order decisions.
- [ ] The screen shows direct owner approval and the absence of agent withdrawal permission.
- [ ] The demo is clearly labeled as local Anvil, not real funds.
- [ ] `pnpm test`, typecheck, web build, Forge, and E2E results are ready.
- [ ] Complete the announcement follow, repost, reply, and submission form.

The deadline is **September 8, 2026 at 23:59 UTC / September 9, 2026 at 08:59 KST**. Recheck the official announcement and form for eligible regions, link formats, and required account details immediately before submitting.
