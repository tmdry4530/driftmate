---
feature: character-agent-rebalancer
spec_id: INT-2026-0001
status: approved
created: 2026-08-31
updated: 2026-09-04
derived_from: tasks.yaml
related:
  - requirements.md
  - design.md
  - acceptance.md
---

# 캐릭터 에이전트 리밸런서 — 구현 태스크

> 2026-09-03 승인된 requirements.md와 design.md를 기준으로 다시 작성했다. 이전 T1~T23의 완료 표시는 현재 계약을 검증하지 못하므로 폐기한다. 태스크 정의는 `tasks.yaml`, 실행 상태는 `state.yaml`, 검증 근거는 `evidence/`가 정본이며 아래 체크박스는 사람이 읽는 파생 뷰다.

## 실행 원칙

- 태스크는 위에서 아래로 진행하며 선행 태스크가 통과하기 전 다음 태스크를 완료 처리하지 않는다.
- 완료는 코드 작성이 아니라 명시된 테스트와 인수 조건이 모두 통과한 상태다.
- 기존 결정 엔진, 지갑 가드, 화면 골격, Narrator 검증기, Live2D 로더, MockDex와 Anvil harness는 가능한 범위에서 재사용한다.
- 새 DB, 다중 DEX 라우터, 전략·공식 레지스트리, 승인 API는 만들지 않는다.
- TWAP·외부 오라클, 실제 x402 결제와 managed balance는 승인된 MVP 이후 항목으로 남긴다.

- [x] **T0. Foundry 실행 환경 복구**
  - 내용: Foundry 도구를 설치하거나 기존 설치 경로를 PATH에 연결하고 프로젝트 설정은 그대로 사용한다. 저장소 파일이나 전역 Git 설정은 바꾸지 않는다.
  - 완료 조건: `forge`, `anvil`, `cast`가 PATH에서 실행된다.
  - 검증: `forge --version`, `anvil --version`, `cast --version`.

## A. 계약과 순수 로직

- [x] **T1. 공유 위임·상태 타입과 해시 규약**
  - 내용: `Delegation`, `PendingDecision`, `PortfolioBaseline`, `KeeperStatus`, `LossReport`와 `(delegationId, decisionId)` 복합 식별자를 공유 타입으로 정의한다. `rebalanceStyleCode`와 `strategyHash = keccak256(abi.encode(...))`를 웹·Keeper가 함께 쓰는 한 함수로 고정하고 `trustFormulaVersion = 1`만 지원한다.
  - 수정 범위: 타입 전용 `packages/shared/src`, `packages/engine/src/characters.ts`, 기존 viem을 쓰는 `apps/keeper/src/delegation.ts`와 고정 벡터 테스트. engine의 런타임 의존성 0은 유지한다.
  - 요구사항: R2.3~R2.5, R3.1~R3.3, R7.1, R10.1.
  - 완료 조건: ABI 인코딩 입력과 기대 hash가 고정 벡터로 잠기고, 상태 타입에 delegationId·configHash·stateNonce가 빠지지 않는다.
  - 검증: `pnpm vitest run packages/shared packages/engine/src`, `pnpm typecheck`.

- [x] **T2. AgentVault 위임 원문과 세션 기준점**
  - 선행: T0, T1.
  - 내용: 승인된 `Delegation` 전체 필드, `delegationId`, `stateNonce`, `budgetSpent`, `operatingSpent`, `configHash`, `PortfolioBaseline`을 구현한다. 정확히 2자산·1 DEX, target/quote 페어, 목표 비중, 기간과 상한 관계를 검증한다. 새 위임은 세션 상태를 초기화한다.
  - 입출금: 활성 위임 중 deposit·withdraw는 위임을 먼저 종결한다. withdraw는 가격 장애와 무관하게 owner에게만 가능하고, false를 반환하는 ERC-20도 실패 처리한다.
  - 수정 범위: `packages/contracts/src/AgentVault.sol`, 구조체 fixture를 포함한 `packages/contracts/test`, 배포 스크립트.
  - 요구사항: R1.2, R2.3~R2.5, R3.1~R3.7, R9.4와 승인된 세션 손익 정책.
  - 완료 조건: Solidity가 T1의 전략 hash 고정 벡터와 일치한다. 설정 round-trip, DEX 페어 거부, 기준점 이벤트, 재위임 초기화, 입출금 철회, 가격 장애 중 인출과 ERC-20 false 반환이 Forge 테스트로 증명된다.
  - 검증: `pnpm contracts:test -- --match-contract AgentVaultDelegationTest`.

- [x] **T3. 온체인 pending과 owner 승인 상태 머신**
  - 선행: T2.
  - 내용: `executeAuto`, `propose`, `executeApproved`, `reject`, `expire`, `finalizePendingFailure`, `recordNotExecuted`를 구현한다. 모든 새 판단은 expectedDelegationId·expectedStateNonce를 검사하고, pending 중 새 판단을 컨트랙트에서 막는다. 철회·입출금·재위임은 열린 pending을 한 번만 종결한다.
  - 승인 경계: 자동 실행은 사용자 `autoThreshold`와 하드캡을 온체인에서 강제한다. 승인 실행은 owner가 저장된 proposalNonce·orderHash·만료 시각과 일치하는 주문만 직접 실행한다.
  - 수정 범위: `AgentVault.sol`, `AgentVaultExecute.t.sol`, 미실행 reason 코드.
  - 요구사항: R3.6, R5.1~R5.6, R6.1~R6.6, R7.4.
  - 완료 조건: stale nonce·위임, autoThreshold 우회, 잘못된 주문, pending 중 경합, 만료와 중복 종결이 모두 차단된다. 승인 실행 실패는 기존 판단·비용을 중복하지 않고 owner가 종결한다.
  - 검증: `pnpm contracts:test -- --match-contract AgentVaultExecuteTest`.

- [x] **T4. 비용 원자성·양방향 실행 기록·실망 기록**
  - 선행: T3.
  - 내용: price cost를 판단 종결과 같은 트랜잭션에 기록하고, 전체 예산과 operatingCap을 함께 강제한다. Narrator 비용은 현재 `(delegationId, decisionId)`에 한 번만 허용한다. `Executed`에 양방향 `valueInQuote`·`valueOutQuote`를 남기고 reportId별 실망 중복을 막는다. 기존 ERC-3009 검증용 토큰 구현을 유지하고 다시 검증한다.
  - 수정 범위: `AgentVault.sol`, `AgentVaultBudget.t.sol`, `AgentVaultExecute.t.sol`, `MockERC3009.sol`, `Mocks.t.sol`.
  - 요구사항: R7.1, R7.4, R7.6~R7.7, R9.7, R10.6, R11.1~R11.6.
  - 완료 조건: 고아 price cost가 없고, 두 예산 상한·양방향 마찰·Narrator 1회·실망 1회 규칙이 단위·fuzz 테스트로 증명된다.
  - 검증: `pnpm contracts:test -- --match-contract AgentVaultBudgetTest`, `pnpm contracts:test -- --match-contract AgentVaultExecuteTest`, `pnpm contracts:test -- --match-contract MockERC3009Test`.

## B. 읽기 모델과 Keeper

- [x] **T5. ABI·체인 어댑터·이벤트 읽기 모델**
  - 선행: T4.
  - 내용: 새 함수·이벤트 ABI와 전체 위임·baseline·pending·nonce 조회를 반영한다. 이벤트를 2-pass로 읽어 `(delegationId, decisionId) → characterId/formulaVersion`을 만든 뒤 실행·미실행·비용을 조인한다. evidence가 손상돼도 인덱스 연결은 보존한다.
  - 수정 범위: `packages/shared/src/record.ts`, `apps/keeper/src/abi.ts`, `ports.ts`, `viemAdapters.ts`, `records.ts`, `index.ts`, 관련 테스트. TrackRecord 고정값을 쓰는 engine·keeper·web 단위 테스트와 E2E fixture도 같은 커밋에서 기계적으로 갱신한다.
  - 요구사항: R7.1~R7.7, R10.1, R10.9, R11.7.
  - 완료 조건: 같은 decisionId가 서로 다른 위임에서 섞이지 않고, 손상 evidence에서도 캐릭터·결과·비용 연결과 트랜잭션 참조가 유지된다.
  - 검증: `pnpm vitest run apps/keeper/src/records.test.ts`, `pnpm typecheck`.

- [x] **T6. 캐릭터별 신뢰·실행 효율·세션 손익**
  - 선행: T5.
  - 내용: `computeTrust(records, characterId, formulaVersion)`와 `computePerformance(records, characterId)`로 경계를 바꾼다. 누적 거래 가치가 0이면 비율은 `N/A`로 둔다. baseline·현재 평가액·operatingSpent로 세션 손익과 reportId를 계산하고, 기대 잔고 불일치는 `cashflow_unknown`으로 중단한다.
  - 수정 범위: `packages/engine/src/trust.ts`, `packages/engine/src/pnl.ts`, `apps/web/src/performance.ts`, 공유 record/trust 타입과 관련 테스트. 새 함수 시그니처를 직접 호출하는 `apps/keeper/src/keeper.ts`, `apps/keeper/e2e/run.ts`, `apps/web/src/App.tsx`는 동작 변경 없이 기계적으로 맞춘다.
  - 요구사항: R7.7, R9.2~R9.4, R10.1~R10.9, R11.7.
  - 완료 조건: 캐릭터 간 기록이 격리되고, 미지원 공식은 fail-closed하며, 같은 근거는 같은 PnL·reportId를 만든다. 시장 손익은 신뢰 입력에 들어가지 않는다.
  - 검증: `pnpm vitest run packages/engine/src apps/web/src/performance.test.ts`, `pnpm typecheck`.

- [x] **T7. Keeper의 온체인 설정 소비와 결정 파이프라인**
  - 선행: T5, T6.
  - 내용: `KeeperConfig`에는 RPC·볼트·블록 유효성·가스 설정만 남긴다. 매 tick 온체인 위임을 읽어 전략 hash·공식 버전을 검증하고, 같은 블록의 잔고·spot·getAmountOut으로 슬리피지까지 포함한 최종 판단을 만든다.
  - 상태·비용: 동시에 한 tick만 허용하고 pending은 체인에서 복원한다. `PaymentAdapter`는 `quote/acquire`만 담당하며, 성공한 가격 스냅샷의 비용은 execute/propose/not-executed 경로가 판단과 함께 기록한다. 자동 실행 revert는 Keeper가 같은 복합 키의 실패로 마감한다.
  - 수정 범위: `apps/keeper/src/keeper.ts`, `payment.ts`, `ports.ts`, `viemAdapters.ts`, `vaultBudgetAdapter.ts`, `keeper.test.ts`.
  - 요구사항: R2.3, R3.1~R3.4, R4.1~R4.8, R5.1~R5.4, R5.7, R6.3, R11.1~R11.5.
  - 완료 조건: 환경·UI shadow 설정 없이 온체인 값만 판단에 쓰고, price cost와 Decided가 함께 성공하거나 함께 실패한다. 신뢰 변화는 거래 내용이 아니라 Gate 결과만 바꾸며 유효 임계값은 사용자 autoThreshold를 넘지 않는다. 기대 잔고가 실제 잔고와 다르면 `cashflow_unknown`으로 판단·실행을 중단한다.
  - 검증: `pnpm vitest run apps/keeper/src/keeper.test.ts`, `pnpm typecheck`.

- [x] **T8. 읽기 전용 status API와 실제 Narrator**
  - 선행: T7.
  - 내용: API를 `GET /status` 하나로 합치고 승인·거절 POST를 제거한다. phase, delegationId/configHash, pending, snapshot, lastDecision, narration, lossReport, lastError를 반환한다. 기존 수치 검증·금지 표현·timeout·템플릿을 Keeper에서 native `fetch` 기반 LLM 어댑터와 연결한다.
  - 비용·복구: Narrator 비용 확정 뒤 decisionId마다 한 번 호출하고, 실패·재시작·근거 불일치는 재과금 없이 템플릿으로 처리한다. 브라우저에는 API 키를 두지 않는다.
  - 수정 범위: `apps/keeper/src/server.ts`, `keeper.ts`, narrator 모듈·테스트, `apps/web/src/narrator`의 중복 코드.
  - 요구사항: R8.1~R8.5, R9.2, R11.1, R11.5.
  - 완료 조건: 상태 전환과 stale 식별자 거부, LLM 성공·timeout·잘못된 수치·재시작 경로가 테스트된다. 외부 변경 API는 존재하지 않는다.
  - 검증: `pnpm vitest run apps/keeper/src`, `pnpm typecheck`.

## C. 웹과 통합

- [x] **T9. 웹 위임·owner 승인·손실·Live2D 연결**
  - 선행: T8.
  - 내용: 서명 전에 캐릭터·전략 hash/version·목표·DEX·slippage·TTL·예산·operatingCap 원문을 표시하고, 제출 후 체인 round-trip이 일치해야 활성화한다. 활성 캐릭터와 목표는 온체인 위임에서 읽는다.
  - 승인·상태: `/status`만 조회하고 delegation/config/decision 식별자가 다른 데이터는 버린다. 승인·거절·실패 종결은 owner 지갑이 컨트랙트를 직접 호출하고 receipt 확정 뒤 새로고침한다. `deriveAgentState`는 `deciding → awaiting_approval → loss → executed → idle` 순서를 지킨다.
  - 손실·표현: 예치·인출과 위임 종료 고지, 세션 손익 근거 우선 표시, report별 실망 버튼, 캐릭터별 신뢰·실행 효율을 연결한다. 기존 Live2D Haru·Ren과 정적 폴백을 유지한다.
  - 수정 범위: `apps/web/src/App.tsx`, hooks, 위임·승인·상태·성과·신뢰 컴포넌트, `characterState.ts`, 관련 테스트·스타일.
  - 요구사항: R1.1~R1.5, R2.1~R3.5, R5.3~R5.5, R5.8, R6.3, R6.5, R7.2~R7.7, R9.1~R9.8, R10.4, R10.6, R10.9, R11.7.
  - 완료 조건: HTTP 승인 경로가 없고 owner receipt, 손실 근거, deciding/loss 표현과 정적 폴백이 한 화면 흐름으로 연결된다. 실제 브라우저에서 Haru·Ren canvas 렌더링, deciding·승인·손실 전환과 Live2D 런타임 차단 시 SVG 폴백을 증거와 함께 확인한다.
  - 검증: `pnpm vitest run apps/web/src`, `pnpm typecheck`, `pnpm --filter @soon/web build`, `KEEP=1 pnpm e2e`로 환경을 띄운 뒤 로컬 브라우저 smoke.

- [x] **T10. Anvil E2E와 인수 조건 전수 재판정**
  - 선행: T9.
  - 내용: 배포 → 예치 → 전체 위임·baseline → 밴드 내 미실행 → 양방향 자동 실행 → 캐릭터별 신뢰 → 손실·실망 → 낮아진 재량의 pending → owner 승인·거절·만료·실패 → Narrator 1회·폴백 → 직접 dust 전송의 `cashflow_unknown` 차단 → 가격 장애 중 인출·위임 종료를 하나의 재현 가능한 흐름으로 검증한다.
  - 정리: 더는 쓰지 않는 Keeper shadow 설정, 메모리 pending, 승인 API와 중복 narrator 코드를 삭제한다. acceptance.md의 과거 집계를 폐기하고 75개 요구사항을 현재 코드·테스트·화면 근거로 다시 판정한다.
  - 수정 범위: `apps/keeper/e2e/run.ts`, 관련 설정·죽은 코드, `acceptance.md`, 완료된 `tasks.md` 체크박스.
  - 요구사항: 성공 기준 1~10과 R1~R11 전체.
  - 완료 조건: 모든 요구사항이 충족이거나 남은 미충족이 근거와 함께 명시되며, 전체 검증 명령이 통과한다.
  - 검증: `pnpm test`, `pnpm typecheck`, `pnpm contracts:test`, `pnpm --filter @soon/web build`, `pnpm e2e`.

## 완료 정의

T10까지 완료하고 acceptance.md의 75개 항목을 현재 근거로 재판정한 뒤에만 기능 상태를 `complete`로 바꾼다. 문서 숫자와 테스트 출력이 다르면 테스트 출력을 기준으로 문서를 고친다.
