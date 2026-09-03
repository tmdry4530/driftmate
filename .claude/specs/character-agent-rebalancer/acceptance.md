---
feature: character-agent-rebalancer
status: verified
created: 2026-09-01
updated: 2026-09-04
related:
  - requirements.md
  - design.md
  - tasks.md
---

# 인수 조건 전수 점검 (T10)

2026-09-04 현재 구현과 테스트, Anvil E2E, 로컬 브라우저 증거를 기준으로 75개 인수 조건을 다시 판정했다.

requirements.md의 인수 조건 75개를 항목별로 대조했다. 판정은 셋이다.

- **충족** — 테스트나 코드 구조로 확인됨
- **부분** — 핵심은 되지만 일부 경로가 비어 있음. 사유와 남은 일을 적는다
- **미충족** — 되지 않음. 사유와 해결 조건을 적는다

검증 기준선: TS 138 · Solidity 66 · E2E 34 (전부 통과)

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
| R2.3 | 충족 | 위임의 `characterId`·`strategyHash`를 AgentVault에 저장하고 Keeper가 매 tick 재검증한다. 고정 hash 벡터와 E2E 통과 |
| R2.4 | 충족 | 파라미터는 엔진 상수. UI에 수정 입력란이 없다 |
| R2.5 | 충족 | 운용 중에는 캐릭터 선택이 잠긴다(`CharacterPicker` `disabled`). 바꾸려면 철회가 선행된다 |

## R3. 목표 비중과 위임

| ID | 판정 | 근거 |
|---|---|---|
| R3.1 | 충족 | `validateDraft` — 비중 합이 항상 10000bp. `delegationDraft.test.ts` 3건 |
| R3.2 | 충족 | 기준·대상 자산, 거래·자동·전체·운영비 한도, 기간, 승인 TTL, slippage, 자산·DEX를 `DelegationForm`과 온체인 구조체가 모두 포함 |
| R3.3 | 충족 | 캐릭터·전략 hash/version·목표·주소·전 한도를 서명 전에 표시하고 receipt 블록의 저장값을 `sameDelegation`으로 round-trip 검증 |
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
| R5.2 | 충족 | E2E 6단계 — 같은 판단이 신뢰 하락 뒤 온체인 pending으로 전환된다. 외부 승인 API는 없다 |
| R5.3 | 충족 | `ApprovalQueue` — 금액·이탈폭·거래·초과분·남은 시간 |
| R5.4 | 충족 | AgentVault의 permissionless `expire`가 TTL 뒤 `NotExecuted(expired)`를 남긴다. Forge와 E2E 통과 |
| R5.5 | 충족 | owner 지갑의 직접 `reject`가 `NotExecuted(rejected)`를 남긴다. HTTP mutation 없음 |
| R5.6 | 충족 | `ExceedsMaxTradeValue` revert. 승인 경로도 볼트를 거치므로 우회 불가 |
| R5.7 | 충족 | 재량이 비율(≤10000bp)이라 상한을 구조적으로 못 넘는다 (`trust.test.ts`, `types.test-d.ts`) |
| R5.8 | 충족 | `capSource` 표시. 화면에서 "알아서 할 수 있는 금액 / 내가 정한 상한" 확인 |

## R6. 온체인 실행

| ID | 판정 | 근거 |
|---|---|---|
| R6.1 | 충족 | `ViemVaultWriter.executeAuto`와 owner `executeApproved`가 receipt를 만들고 이벤트 txHash가 읽기 모델에 보존된다 |
| R6.2 | 충족 | 볼트가 자산·DEX·하드캡·자동 상한·예산을 재검증한다. `AgentVaultExecute.t.sol` 21건 |
| R6.3 | 충족 | 실패 receipt는 화면에 표시되고 pending은 유지되며 owner가 `finalizePendingFailure`로 종결한다. Forge와 E2E 통과 |
| R6.4 | 충족 | quote 기반 `minAmountOut`과 볼트의 실수령량 재확인. 슬리피지 허용치를 서명 원문에서 읽는다 |
| R6.5 | 충족 | 웹은 receipt 성공과 위임 round-trip을 확인한 뒤 체인·Keeper를 함께 새로고침한다 |
| R6.6 | 충족 | `decisionRecorded[delegationId][decisionId]` 복합 키가 중복 실행을 막고 새 세션 재사용은 허용한다 |

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
| R8.1 | 충족 | Keeper만 `narrate(evidence, persona)`를 호출하고 웹은 검증된 `/status` 설명만 읽는다 |
| R8.2 | 충족 | `Narration`을 실행 인자로 넘기면 컴파일 실패 (`isolation.test-d.ts`) |
| R8.3 | 충족 | 실패·타임아웃 시 템플릿 대체, 흐름 유지 (`narrate.test.ts`) |
| R8.4 | 충족 | 예측·권유 표현 필터 (`narrate.test.ts`) |
| R8.5 | 충족 | 근거 밖 수치 폐기 + 금액 표현 차단 (`narrate.test.ts`) |

## R9. 캐릭터 표현과 톤

| ID | 판정 | 근거 |
|---|---|---|
| R9.1 | 충족 | Cubism 런타임 로더로 Haru·Ren 실제 canvas 렌더링을 브라우저 확인했다 (`evidence/T009-haru.png`, `T009-ren.png`) |
| R9.2 | 충족 | `deriveAgentState`가 deciding → awaiting → loss → executed → idle 우선순위를 고정한다. 실제 pending·실행·손실 화면도 확인 |
| R9.3 | 충족 | 손실 표정 타입에 밝은 계열이 아예 없다 (`characterState.test-d.ts`). Narrator도 손실 구간 금지어를 거른다 |
| R9.4 | 충족 | 온체인 `PortfolioBaseline`과 동일 DEX 현재 가격, 직접 현금흐름 검사를 사용해 세션 손익을 재현한다. 수치·기준점·가격 근거를 반응보다 먼저 표시 |
| R9.5 | 충족 | 런타임 부재 브라우저에서 SVG 폴백과 나머지 입력·선택 유지 확인 (`evidence/T009-fallback.png`) |
| R9.6 | 충족 | 비난 표현 필터 (`narrate.test.ts`) |
| R9.7 | 충족 | 검증된 손실 reportId에만 실망 버튼을 열고 온체인 기록 뒤 `apologetic` 표정으로 전환한다 |
| R9.8 | 충족 | 처벌·학대 상호작용이 코드에 존재하지 않는다 |

## R10. 신뢰와 재량

| ID | 판정 | 근거 |
|---|---|---|
| R10.1 | 충족 | 이벤트만 입력. 순서 뒤섞어도 동일 결과 (`trust.test.ts`) |
| R10.2 | 충족 | 마찰비용(슬리피지+운영비) 비율로 순성과 판정 |
| R10.3 | 충족 | `TrackRecord`에 접속·결제 필드가 없다 (`types.test-d.ts`) |
| R10.4 | 충족 | `TrustPanel` — 점수·재량·기여 목록·유효 금액 표시 |
| R10.5 | 충족 | 마찰이 크면 감점 → 재량 축소 (`trust.test.ts`) |
| R10.6 | 충족 | 검증된 reportId별 `signalDisappointment`가 즉시 신뢰·재량을 낮추며 중복은 컨트랙트가 거부한다 |
| R10.7 | 충족 | 실적 외 회복 경로 없음 (`trust.test.ts`). 결제 UI 부재 |
| R10.8 | 충족 | 신뢰만 다른 두 입력에서 `Decision` 동일 (`trust.test.ts`) |
| R10.9 | 충족 | 기여 목록에 블록·사유·증감. 화면 확인 |

## R11. 운영비와 결제 경계

| ID | 판정 | 근거 |
|---|---|---|
| R11.1 | 충족 | `CostMeter` → 가격 판단 원자 비용·Narrator 1회 비용 → 단일 예산 차감과 이벤트 기록. E2E 확인 |
| R11.2 | 충족 | 소진 시 유료 호출 중단(`keeper.test.ts`) + 화면 경고(`DelegationStatus`) |
| R11.3 | 충족 | `PaymentAdapter` 교체 테스트 (`keeper.test.ts`) |
| R11.4 | 충족 | `MockERC3009` + `transferWithAuthorization` 서명 경로 검증 (`Mocks.t.sol` 4건) |
| R11.5 | 충족 | 비용이 `decisionId`에 귀속 (`keeper.test.ts`, E2E) |
| R11.6 | 충족 | 단일 예산 fuzz 512회 |
| R11.7 | 충족 | 누적 운영비와 총 마찰, 운영비가 대표 성과에 미친 비율을 함께 표시한다 |

---

## 집계

| 판정 | 개수 |
|---|---|
| 충족 | 75 |
| 부분 | 0 |
| 미충족 | 0 |

## 브라우저 증거

- `evidence/T010-pending.png`: 온체인 식별자와 일치한 승인 요청, Live2D canvas, 거래·금액·근거·초과분.
- `evidence/T010-approved.png`: owner 직접 승인 receipt 뒤 pending 제거, 실행 이벤트와 완료 설명.
- `evidence/T010-loss.png`: 동일 가격 원천의 손실 수치·기준점·운영비·캐릭터 반응.
