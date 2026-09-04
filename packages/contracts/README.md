# Contracts

Foundry package containing DriftMate's isolated vault, a test ERC-3009 token, and a mock DEX.

Run from the repository root.

```bash
pnpm contracts:setup
pnpm contracts:test
```

`contracts:setup` restores `forge-std` v1.16.2 into the ignored `lib/` directory. Run `pnpm e2e` from the repository root to verify the complete local-chain flow.
