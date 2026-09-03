# Contracts

DriftMate의 격리 볼트, 검증용 ERC-3009 토큰과 Mock DEX를 담은 Foundry 패키지다.

저장소 루트에서 실행한다.

```bash
pnpm contracts:setup
pnpm contracts:test
```

`contracts:setup`은 `forge-std` v1.16.2를 ignored `lib/`에 복원한다. 전체 로컬 체인 흐름은 루트의 `pnpm e2e`로 검증한다.
