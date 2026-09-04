---
feature: midnight-private-mandate
spec_id: INT-2026-0904
derived_from: tasks.yaml
related:
  - requirements.md
  - design.md
  - state.yaml
  - traceability.yaml
---

# Midnight Private Character — 실행 현황

> 이 파일은 `tasks.yaml` 정의와 `state.yaml` 실행 상태의 사람용 파생 뷰다. 상태를 직접 편집하지 않는다.

- [ ] **T001. Compact 도구체인과 private 관계 계약 구축** — `pending`
  - Outcome: exact-pin 로컬 도구체인으로 관계 생성·철회를 컴파일하고 public ledger에는 commitment와 version만 남긴다.
  - 요구사항: R2.1, R2.2, R2.3, R3.1, R5.4, R8.2, R8.3, R8.5
  - Verify: `pnpm midnight:versions && pnpm midnight:compile && pnpm midnight:test`

- [ ] **T002. 캐릭터 판단 proof와 관계 신뢰 전이 구현** — `pending`
  - Outcome: 기존 엔진의 두 캐릭터 판단·재량·관계 전이를 Compact가 검증하고 위반과 replay를 거부한다.
  - 요구사항: R3.2~R3.4, R4.1~R4.4, R5.1~R5.4, R6.1~R6.6, R6.8, R8.3
  - Verify: `pnpm midnight:compile && pnpm midnight:test && pnpm test && pnpm typecheck`

- [ ] **T003. Lace 연결과 브라우저 private proof client 구축** — `pending`
  - Outcome: Lace·공식 provider 연결, strict proof input, 메모리 private state, loopback prover 제한을 fail-closed로 제공한다.
  - 요구사항: R2.4~R2.6, R3.4~R3.5, R4.4, R5.5, R6.8, R8.2
  - Verify: `pnpm exec vitest run apps/web/src/midnight && pnpm typecheck && pnpm --filter @soon/web build`

- [ ] **T004. 캐릭터 중심 Midnight 데모 UI 재설계** — `pending`
  - Outcome: 캐릭터·재량·다음 행동이 주인공인 90초 흐름에서 Private·Proven·Public을 접근 가능하게 구분한다.
  - 요구사항: R1.1~R1.5, R2.5, R3.5~R3.6, R5.5, R6.3~R6.4, R6.7~R6.9, R7.1~R7.7
  - Verify: `pnpm exec vitest run apps/web/src/MidnightApp.test.tsx apps/web/src/components/CharacterStage.test.ts && pnpm typecheck && pnpm --filter @soon/web build`

- [ ] **T005. Local Devnet 실제 proof E2E 완성** — `pending`
  - Outcome: valid flow는 실제 proof와 finalized transaction을 만들고 위반·replay·private 누출 검사는 실패한다.
  - 요구사항: R2.2, R2.4, R3.3, R4.2, R5.1~R5.5, R6.3~R6.6, R6.8~R6.9, R7.3, R8.2~R8.3, R8.5
  - Verify: `pnpm midnight:e2e`

- [ ] **T006. 제출 문서와 전체 회귀 검증 마감** — `pending`
  - Outcome: README만으로 새 clone의 90초 데모가 재현되고 베이스 6종과 Midnight 4종 검증이 모두 통과한다.
  - 요구사항: R1.2~R1.5, R6.7~R6.9, R8.1~R8.5
  - Verify: `tasks.yaml` T006의 full 검증 10종
