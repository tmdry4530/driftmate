# Midnight Korea Hackathon 2026 제출본

## Project name

DriftMate — Private Character Protocol

## One-line description

내 전략은 캐릭터만 알고, Midnight은 그 아이가 약속을 지켰는지만 증명한다.

## GitHub repository

https://github.com/tmdry4530/driftmate-midnight

## Public demo

https://tmdry4530.github.io/driftmate/

정적 UI는 공개 URL에서 바로 확인할 수 있다. 실제 proof는 private witness가 원격 서버로 나가지 않도록 Lace와 loopback `:6300` prover가 필요하다.

## How to run / demo flow

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm midnight:setup
pnpm midnight:e2e
cp .env.example apps/web/.env
pnpm -C apps/web dev
```

1. Lace를 연결한다.
2. Haru 또는 Ren과 비공개 mandate를 만든다.
3. 기존 결정론 엔진이 캐릭터 판단을 만든다.
4. Compact circuit이 캐릭터 전략·예산·만료·재량·replay를 검증한다.
5. Midnight ledger에는 원문 대신 commitment와 receipt만 남는다.

상세 90초 시나리오와 실패 진단은 저장소 `README.md`에 있다.

## How Midnight is used

DriftMate는 Compact contract로 캐릭터와 private mandate의 관계를 commitment에 고정한다. 판단 proof는 고정 캐릭터 전략, 목표 비중, 허용 이탈폭, 누적 예산, 만료, 신뢰 기반 재량과 decision replay 여부를 회로에서 다시 검증한다. public ledger에는 commitment, version, decision ID와 판정 receipt만 기록되고 캐릭터 ID·mandate 원문·owner secret·nonce·정확한 신뢰 이력은 공개하지 않는다. Midnight receipt는 자산을 보관하거나 swap을 실행한 증거가 아니며, 기존 EVM AgentVault가 별도 실행 경계로 남는다.

## Submission images

- [Desktop](./submission/driftmate-desktop.png)
- [Mobile](./submission/driftmate-mobile.png)

Demo video는 선택 항목이다. 녹화 시 `README.md`의 90초 시나리오와 실제 `pnpm midnight:e2e` 성공 결과를 함께 보여준다.

제출 마감: 2026-09-28 00:00 KST — [공식 안내](https://www.hackathon.midnightkorea.org/)
