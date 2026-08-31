---
feature: character-agent-rebalancer
status: approved
created: 2026-09-01
related:
  - requirements.md
  - design.md
  - tasks.md
---

# 인수 조건 전수 점검 (T22)

requirements.md의 인수 조건 75개를 항목별로 대조했다. 판정은 셋이다.

- **충족** — 테스트나 코드 구조로 확인됨
- **부분** — 핵심은 되지만 일부 경로가 비어 있음. 사유와 남은 일을 적는다
- **미충족** — 되지 않음. 사유와 해결 조건을 적는다

검증 기준선: TS 107 · Solidity 52 · E2E 19 (전부 통과)

---

## R1. 지갑 연결과 체인 중립

| ID | 판정 | 근거 |
|---|---|---|
| R1.1 | 충족 | `WalletBar.tsx` — 주소·체인 ID 표시. `chainGuard.test.ts` 4건 |
| R1.2 | 충족 | 개인키를 받는 경로가 없다. 볼트 `withdraw`는 수신자 인자가 없어 항상 owner로만 나간다 (`AgentVaultDelegation.t.sol:test_withdrawAlwaysGoesToOwner`) |
| R1.3 | 충족 | `evaluateGuard` → `wrong_chain`이면 실행 UI 비활성 (`chainGuard.test.ts`) |
| R1.4 | 충족 | 체인 설정은 전부 `config.ts`의 환경값. 코드에 체인 ID 없음. E2E가 Anvil에서 그대로 동작 |
| R1.5 | 충족 | 주소가 사라지면 `evaluateGuard`가 즉시 `disconnected`로 떨어지고 실행 버튼이 잠긴다 |

## R2. 캐릭터와 전략 인격

| ID | 판정 | 근거 |
|---|---|---|
| R2.1 | 충족 | `characters.ts` — `timid`·`easygoing` 2종, 각각 하나의 `StrategyParams` |
| R2.2 | 충족 | `CHARACTER_VIEWS` — 서술 문장 + 이탈폭·복귀 방식·최소 거래액 수치 병기 (화면 확인) |
| R2.3 | 충족 | `decide()`가 `strategy`를 기준으로 판단. `decide.test.ts` — 같은 입력에 캐릭터만 바꾸면 결과가 갈린다 |
| R2.4 | 충족 | 파라미터는 엔진 상수. UI에 수정 입력란이 없다 |
| R2.5 | 충족 | 운용 중에는 캐릭터 선택이 잠긴다(`CharacterPicker` `disabled`). 바꾸려면 철회가 선행된다 |

## R3. 목표 비중과 위임

| ID | 판정 | 근거 |
|---|---|---|
| R3.1 | 충족 | `validateDraft` — 비중 합이 항상 10000bp. `delegationDraft.test.ts` 3건 |
| R3.2 | 충족 | `Delegation` 구조체에 6개 항목 전부. `DelegationForm` 입력 |
| R3.3 | 충족 | 서명 전 전문 표시(화면 확인). `setDelegation`은 owner 서명 필요 |
| R3.4 | 충족 | 볼트 `onlyExecutor`가 `block.timestamp > expiry`면 revert. `keeper.tick`도 같은 단위로 중단 |
| R3.5 | 충족 | `revoke()` + `DelegationStatus`의 철회 버튼. `test_revokeStopsDelegationImmediately` |
| R3.6 | 충족 | `isAllowedAsset` 검증. `test_disallowedAssetReverts` |
| R3.7 | 충족 | 거래·운영비가 `budgetSpent` 하나를 공유. fuzz 3종 512회 (`AgentVaultBudget.t.sol`) |

## R4. 결정론적 판단

| ID | 판정 | 근거 |
|---|---|---|
| R4.1 | 충족 | 동일 입력 1000회 반복 해시 일치 (`decide.test.ts`) |
| R4.2 | 충족 | 목표 복귀 거래 산출. E2E에서 이탈 648bp → $772 거래 |
| R4.3 | 충족 | 밴드 내 무거래 (`decide.test.ts`, E2E 2단계) |
| R4.4 | 충족 | `DecisionEvidence`에 자산별 현재·목표 비중, 이탈폭, 밴드. E2E에서 온체인 복원 확인 |
| R4.5 | 충족 | 시계 조작 후에도 동일 결과. 엔진 런타임 의존성 0 (`purity.test.ts`) |
| R4.6 | 충족 | 스냅샷 만료 시 `stale_price`로 중단 (`decide.test.ts`, `priceSource.ts`) |
| R4.7 | 충족 | 가스+슬리피지+운영비 합산 판정. Keeper는 **데이터를 사기 전에** 사전 판단 (`keeper.test.ts`) |
| R4.8 | 충족 | `DecisionInput`에 신뢰 필드가 없다 (`types.test-d.ts`) |

## R5. 임계값 분기 승인

| ID | 판정 | 근거 |
|---|---|---|
| R5.1 | 충족 | E2E 4단계 — 임계값 내 자동 실행 |
| R5.2 | 충족 | E2E 6단계 — 신뢰 하락 후 승인 요청으로 전환. 단, 승인 API에 인증이 없어 로컬 바인딩에 의존한다 (design 미해결 6) |
| R5.3 | 충족 | `ApprovalQueue` — 금액·이탈폭·거래·초과분·남은 시간 |
| R5.4 | 충족 | `expireStaleApprovals` → `NotExecuted(expired)` (`keeper.test.ts`) |
| R5.5 | 충족 | `keeper.reject` → `NotExecuted(rejected)` (`keeper.test.ts`) |
| R5.6 | 충족 | `ExceedsMaxTradeValue` revert. 승인 경로도 볼트를 거치므로 우회 불가 |
| R5.7 | 충족 | 재량이 비율(≤10000bp)이라 상한을 구조적으로 못 넘는다 (`trust.test.ts`, `types.test-d.ts`) |
| R5.8 | 충족 | `capSource` 표시. 화면에서 "알아서 할 수 있는 금액 / 내가 정한 상한" 확인 |

## R6. 온체인 실행

| ID | 판정 | 근거 |
|---|---|---|
| R6.1 | 충족 | `ViemVaultWriter.execute` → 트랜잭션 해시 반환, 기록에 보존 |
| R6.2 | 충족 | 볼트가 한도를 재검증. 오프체인 게이트를 우회해도 컨트랙트가 막는다 (`AgentVaultExecute.t.sol` 17건) |
| R6.3 | 충족 | 실패 시 상태 미변경(revert) + 화면에 실패 사유 표시(`App.tsx` `send`) |
| R6.4 | 충족 | `minAmountOut` + 볼트의 실수령량 재확인. `test_slippageBeyondToleranceReverts` |
| R6.5 | 충족 | 확정 후 `refresh()`로 잔고·기록 재조회 |
| R6.6 | 충족 | `decisionUsed` 매핑. `test_duplicateDecisionReverts` |

## R7. 온체인 트랙레코드

| ID | 판정 | 근거 |
|---|---|---|
| R7.1 | 충족 | `Decided` + `Executed` 이벤트. E2E에서 근거 복원 확인 |
| R7.2 | 충족 | `loadTrackRecords`가 이벤트만 읽는다. DB 사본 없음 |
| R7.3 | 충족 | 이벤트 로그는 수정·삭제 경로가 없다 |
| R7.4 | 충족 | `NotExecuted` 기록. 화면에서 "안 함 · 비용이 이득보다 커서" 확인 |
| R7.5 | 충족 | 각 기록에 `txHash` 보존, 화면에 표시. 익스플로러가 있으면 링크 |
| R7.6 | 충족 | `CostCharged`가 `decisionId`에 묶여 기록 |
| R7.7 | 충족 | 대표값이 운영비 포함 총 마찰. 슬리피지 단독 수치는 내역 안에만 (`performance.test.ts`) |

## R8. 캐릭터 설명

| ID | 판정 | 근거 |
|---|---|---|
| R8.1 | 충족 | `narrate(evidence, persona)`. 화면은 온체인 근거로만 문장을 만든다 |
| R8.2 | 충족 | `Narration`을 실행 인자로 넘기면 컴파일 실패 (`isolation.test-d.ts`) |
| R8.3 | 충족 | 실패·타임아웃 시 템플릿 대체, 흐름 유지 (`narrate.test.ts`) |
| R8.4 | 충족 | 예측·권유 표현 필터 (`narrate.test.ts`) |
| R8.5 | 충족 | 근거 밖 수치 폐기 + 금액 표현 차단 (`narrate.test.ts`) |

## R9. 캐릭터 표현과 톤

| ID | 판정 | 근거 |
|---|---|---|
| R9.1 | **미충족** | Live2D Cubism SDK는 라이선스 동의가 필요해 저장소에 넣을 수 없다. `Live2DLoader` 인터페이스와 로딩 경로는 구현되어 있고, SDK를 넣으면 그대로 붙는다. 지금은 항상 폴백(R9.5)으로 동작한다 |
| R9.2 | **부분** | 표정 매핑과 전환은 구현·검증됨(`characterState.test.ts`). 다만 화면이 만들 수 있는 상태는 대기·승인요청·실행완료 셋이다. `deciding`은 실행자 진행 상황을 화면이 알 수 없고, `loss`는 R9.4에 막혀 있다 |
| R9.3 | 충족 | 손실 표정 타입에 밝은 계열이 아예 없다 (`characterState.test-d.ts`). Narrator도 손실 구간 금지어를 거른다 |
| R9.4 | **미충족** | 포트폴리오 손익을 계산할 수 없다 — 예치 시점 가격이 이벤트에 기록되지 않는다. `buildLossReport`(수치 먼저, 반응 나중)는 구현·검증되어 있으나 화면이 손실 상태를 만들지 못한다. 근사값을 손익처럼 보여주지 않기로 한 결과다 |
| R9.5 | 충족 | 로더 실패·부재 시 정적 표현으로 대체. 현재 기본 경로 |
| R9.6 | 충족 | 비난 표현 필터 (`narrate.test.ts`) |
| R9.7 | 충족 | 실망 시 `apologetic` 표정 + 변명 표현 차단 |
| R9.8 | 충족 | 처벌·학대 상호작용이 코드에 존재하지 않는다 |

## R10. 신뢰와 재량

| ID | 판정 | 근거 |
|---|---|---|
| R10.1 | 충족 | 이벤트만 입력. 순서 뒤섞어도 동일 결과 (`trust.test.ts`) |
| R10.2 | 충족 | 마찰비용(슬리피지+운영비) 비율로 순성과 판정 |
| R10.3 | 충족 | `TrackRecord`에 접속·결제 필드가 없다 (`types.test-d.ts`) |
| R10.4 | 충족 | `TrustPanel` — 점수·재량·기여 목록·유효 금액 표시 |
| R10.5 | 충족 | 마찰이 크면 감점 → 재량 축소 (`trust.test.ts`) |
| R10.6 | 충족 | `signalDisappointment` → 즉시 하향. E2E 6단계 (53 → 0) |
| R10.7 | 충족 | 실적 외 회복 경로 없음 (`trust.test.ts`). 결제 UI 부재 |
| R10.8 | 충족 | 신뢰만 다른 두 입력에서 `Decision` 동일 (`trust.test.ts`) |
| R10.9 | 충족 | 기여 목록에 블록·사유·증감. 화면 확인 |

## R11. 운영비와 결제 경계

| ID | 판정 | 근거 |
|---|---|---|
| R11.1 | 충족 | `CostMeter` → `chargeCost` → 예산 차감·기록. E2E에서 $0.50 확인 |
| R11.2 | 충족 | 소진 시 유료 호출 중단(`keeper.test.ts`) + 화면 경고(`DelegationStatus`) |
| R11.3 | 충족 | `PaymentAdapter` 교체 테스트 (`keeper.test.ts`) |
| R11.4 | 충족 | `MockERC3009` + `transferWithAuthorization` 서명 경로 검증 (`Mocks.t.sol` 4건) |
| R11.5 | 충족 | 비용이 `decisionId`에 귀속 (`keeper.test.ts`, E2E) |
| R11.6 | 충족 | 단일 예산 fuzz 512회 |
| R11.7 | 충족 | "운영비가 대표 수치를 0.11%만큼 끌어올렸어요" (화면 확인) |

---

## 집계

| 판정 | 개수 |
|---|---|
| 충족 | 72 |
| 부분 | 1 (R9.2) |
| 미충족 | 2 (R9.1, R9.4) |

## 미충족 3건의 해결 조건

**R9.1 — Live2D 렌더링.** 사용자가 live2d.com에서 Cubism SDK for Web과 샘플 모델을 받아 `apps/web/public/live2d/`에 놓고 `Live2DLoader` 구현을 주입하면 충족된다. 라이선스 동의가 필요한 절차라 대신 수행할 수 없다. 연매출 1,000만 엔 미만은 무료.

**R9.4 — 손실 보고.** 포트폴리오 손익을 정직하게 계산하려면 예치 시점의 quote 기준 가치가 필요하다. 볼트의 `Deposited` 이벤트에 그 시점 평가액을 함께 남기면 해결된다. 컨트랙트 변경이 따르므로 별도 태스크로 다룬다.

**R9.2 — 상태 전환(부분).** `loss`는 R9.4에 종속된다. `deciding`은 실행자가 판단 중임을 화면에 알리는 경로(예: `/pending`과 같은 상태 엔드포인트)를 추가하면 채워진다.

세 건 모두 **구현이 틀린 것이 아니라 외부 의존과 데이터 부재** 때문이며, 로직과 테스트는 이미 자리에 있다.
