# DriftMate — Private Character Protocol

> 내 전략은 캐릭터만 알고, Midnight은 그 아이가 약속을 지켰는지만 증명한다.

DriftMate는 캐릭터에게 비공개 운용 원칙을 맡기고, 그 캐릭터가 고정된 전략과 현재 재량을 지켰는지 Midnight proof로 확인하는 비수탁형 에이전트 프로젝트다. 캐릭터는 장식이 아니라 `고정 전략 + 설명 말투 + 검증된 신뢰·재량 이력`을 가진다. 신뢰가 바꾸는 것은 자동 실행 자격뿐이며 거래 방향·목표 비중·금액 계산은 기존 결정론 엔진이 담당한다.

공개 UI: https://tmdry4530.github.io/driftmate/ — 실제 proof는 private witness 보호를 위해 Lace와 loopback `:6300` prover가 필요하다.

## 캐릭터 관리 루프

1. Haru 또는 Ren을 선택한다. 각 캐릭터는 변경할 수 없는 하나의 전략 버전에 연결된다.
2. 목표 비중, 허용 이탈폭, 자동 재량 한도, 누적 예산, 만료를 비공개 mandate로 맡긴다.
3. `packages/engine`이 같은 입력에는 같은 제안과 decision ID를 만든다.
4. Compact circuit이 캐릭터 전략, mandate, 예산, 만료, 신뢰 기반 재량과 replay 여부를 다시 검증한다.
5. 공개 receipt와 실제 관계 이벤트에 따라 캐릭터의 신뢰·재량이 변하고, 경계를 넘으면 owner 결정을 기다린다.

| 경계 | 포함하는 것 | 포함하지 않는 것 |
|---|---|---|
| **Private · 이 기기에서만** | 캐릭터 ID, mandate 원문, owner secret, nonce, 정확한 신뢰·관계 이력, 잔고 입력 | localStorage, URL, 서버 저장 |
| **Proven · circuit이 검증** | 등록 전략 일치, mandate 준수, 예산·만료·재량, decision replay 거부 | 수익성, 시장 예측, EVM 거래 실행 여부 |
| **Public · Midnight ledger** | commitment, version, decision ID, 판정 상태, receipt sequence | 캐릭터 ID, 목표 비중, 한도·예산 원문, 정확한 신뢰 점수 |

Midnight은 자산을 보관하거나 swap하지 않고 기존 EVM 실행을 강제하지 않는다. EVM `AgentVault`의 executor·allowlist·만료·상한·예산·owner-only withdrawal은 별도 최종 경계이며, Midnight receipt와 EVM transaction은 서로 다른 증거다. 이 프로젝트는 수익을 예측하거나 보장하지 않는다.

## 구현 위치

| 역할 | 위치 |
|---|---|
| 결정론 캐릭터 전략·판단·신뢰 | `packages/engine/` |
| Compact 관계·판단·재량 회로 | `packages/midnight-contract/CharacterMandate.compact` |
| generated contract·ZK assets | `packages/midnight-contract/managed/character-mandate/` |
| Lace/provider·메모리 private state | `apps/web/src/midnight/` |
| 캐릭터 중심 데모 UI | `apps/web/src/MidnightApp.tsx` |
| 실제 Local Devnet proof E2E | `packages/midnight-contract/e2e/run.ts` |

## 사전 요구사항

검증한 조합은 아래와 같다. Node와 pnpm 버전은 저장소에서 강제하며, Docker와 Foundry는 베이스 전체 검증에 필요하다.

| 도구 | 버전 |
|---|---|
| Node.js | `>=24.12.0` |
| pnpm | `11.17.0` |
| Docker / Compose | `29.4.0` / `5.1.2` 검증 |
| Foundry | Forge `1.8.1` 검증 |
| Compact CLI / compiler | `0.5.1` / `0.31.1` |
| Midnight.js / testkit | `4.1.1` |
| Compact runtime / Compact JS / Ledger | `0.16.0` / `2.5.1` / `8.1.0` |

브라우저에서 전체 흐름을 실행하려면 DApp Connector API 4.x를 지원하는 Lace가 필요하다. Lace의 network ID와 `VITE_MIDNIGHT_NETWORK_ID`가 같아야 하며, prover URI는 `http://localhost:6300` 또는 `http://127.0.0.1:6300`만 허용한다. indexer URI는 Lace 설정에서 읽는다.

## 설치와 실행

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm midnight:setup
cp .env.example apps/web/.env
pnpm -C apps/web dev
```

첫 화면은 지갑이나 proof가 없을 때 성공 데이터를 만들지 않고 `OFFLINE`으로 시작한다. Lace와 같은 Midnight 네트워크의 로컬 prover가 준비되면 `Lace 연결 → 캐릭터 선택 → 비공개 관계 열기 → 캐릭터 판단 증명` 순서로 진행한다. private state는 메모리에만 있으므로 새로고침하면 관계를 새로 만들어야 한다.

Lace 없이 실제 proof 경로만 재현하려면 Docker daemon을 켜고 다음을 실행한다.

```bash
pnpm midnight:e2e
```

이 명령은 proof server `8.1.0`, indexer `4.3.2`, Midnight node `1.0.0`을 Local Devnet으로 시작하고 종료한다. 실제 관계·판단 proof, finalized transaction, 다른 캐릭터 대입 거부, replay 거부, transaction의 private fixture 누출 부재를 검사한다. 콜드 스타트와 이미지 다운로드 시간은 90초 데모 시간에 포함하지 말고 사전 점검한다.

기존 EVM 베이스 화면은 다음처럼 실행한다.

```bash
cp apps/web/.env.example apps/web/.env
VITE_APP_MODE=base pnpm -C apps/web dev
```

## 90초 데모

데모 전 `pnpm midnight:e2e` 성공과 Lace·local prover 연결을 확인한다.

- **0–15초:** 첫 화면에서 캐릭터가 고정 전략과 관계 이력을 가진 에이전트이며, 신뢰는 재량만 바꾼다고 설명한다.
- **15–30초:** Private / Proven / Public 표에서 캐릭터와 mandate 원문은 숨고 commitment와 receipt만 공개됨을 보여준다.
- **30–50초:** 캐릭터와 mandate를 선택해 관계 commitment를 만든다.
- **50–75초:** 같은 결정론 엔진 제안을 proof로 검증하고 receipt의 decision ID·version·상태를 확인한다.
- **75–90초:** 재량을 넘으면 owner 결정이 필요하며, Midnight proof는 자산 수탁·swap·EVM 실행 증거가 아님을 짚는다.

## 검증

베이스 계약 검증:

```bash
pnpm test
pnpm typecheck
pnpm --filter @soon/web build
pnpm contracts:setup
pnpm contracts:test
pnpm e2e
```

Midnight 추가 검증:

```bash
pnpm midnight:versions
pnpm midnight:compile
pnpm midnight:test
pnpm midnight:e2e
```

## 실패 진단

| 증상 | 확인할 것 |
|---|---|
| `Compact CLI가 없습니다` | `pnpm midnight:setup` 실행 후 `pnpm midnight:versions` 확인 |
| Docker 연결 또는 image pull 실패 | Docker daemon과 네트워크를 확인하고 `pnpm midnight:e2e` 재실행 |
| Lace를 찾지 못함 | 지갑 잠금 해제와 DApp Connector API 4.x 지원 여부 확인 |
| wallet/contract network 불일치 | Lace network와 `VITE_MIDNIGHT_NETWORK_ID`를 동일하게 설정 |
| proof server 거부 | Lace prover URI를 정확히 loopback `:6300`으로 설정; 원격 prover는 허용하지 않음 |
| indexer 또는 proof 오류 | Local Devnet/indexer/prover 상태를 복구한 뒤 실패한 단계에서 재시도; 가짜 receipt는 생성되지 않음 |
| 새로고침 뒤 private state 없음 | 기본값으로 복원하지 않으므로 새 비공개 관계를 생성 |

## 베이스 프로젝트와 라이선스 자산

`main`은 체인 중립 베이스이며 행사·체인 통합은 확장 브랜치에 격리한다. Live2D 없이 정적 SVG 폴백이 동작한다. Cubism SDK와 모델은 라이선스 때문에 커밋하지 않으며, 로컬 설치가 필요하면 `pnpm live2d:setup /path/to/CubismSdkForWeb-5-r.5.zip`을 사용한다. 현재는 로컬 해커톤 데모이므로 실자금에 사용하지 않는다.
