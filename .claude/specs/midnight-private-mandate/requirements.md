---
feature: midnight-private-mandate
spec_id: INT-2026-0904
mode: feature
risk: L2
status: approved
created: 2026-09-04
related:
  - state.yaml
  - ../character-agent-rebalancer/requirements.md
  - ../character-agent-rebalancer/design.md
  - ../adr/0001-delegation-model.md
  - ../adr/0003-trust-score-location.md
  - ../adr/0005-onchain-delegation-source.md
---

# Midnight Private Character — 요구사항

## 1. Shape

- **문제와 근거**: 현재 DriftMate의 차별점은 캐릭터가 고정된 전략을 대표하고, 실행 실적으로 신뢰와 재량을 얻거나 사용자의 실망으로 재량을 잃는다는 점이다. 이를 단순한 비공개 포트폴리오 검증기로 바꾸면 캐릭터가 장식이 되고 평범한 리밸런서만 남는다. 동시에 현재 공개 EVM 흐름에서는 사용자가 어떤 캐릭터와 위험 성향을 골랐는지, 관계 이력이 어떻게 변했는지가 모두 노출될 수 있다. Midnight Korea Hackathon은 저장소 빌드 성공, README와 제출 설명의 일치, Midnight 기능의 명확성, 재현 가능한 데모를 확인한다.
- **원하는 outcome**: 사용자는 캐릭터에게 비공개 운용 원칙을 맡기고 관계를 관리한다. Midnight는 캐릭터 선택, 위험 성향, 정확한 신뢰 점수와 이력을 공개하지 않은 채 **등록된 캐릭터 전략이 일관되게 판단했고 현재 얻은 재량을 넘지 않았다는 사실**만 증명한다. 90초 데모와 제품 문장은 **“내 전략은 캐릭터만 알고, Midnight은 그 아이가 약속을 지켰는지만 증명한다.”**로 통일한다.
- **Appetite**: 기존 두 캐릭터, 결정론 엔진, 신뢰·재량 계산, 표현 상태, EVM 안전 경계를 재사용한다. Midnight Local Devnet 또는 Preprod에서 실제 Compact proof와 공개 receipt가 생성되는 `캐릭터 선택 → 비공개 위임 → 판단과 설명 → 증명 → 관계 변화`의 한 흐름에 집중한다.
- **Non-goals**: Midnight에서 실제 DEX 거래, EVM↔Midnight 브리지 또는 온체인 proof relay, 메인넷 실자금, 가격 예측, LLM 판단, 새 토큰, 소셜·랭킹, 캐릭터 추가, 행사 사이트 복제, CertiK 연동은 이번 범위에 포함하지 않는다.
- **Rabbit holes**: Compact SDK·지갑 버전 호환성, 증명 생성 시간, private state 복구, 캐릭터 ID를 밝히지 않는 등록 전략 membership 검증, 관계 이력의 공개 transcript 누출, 기존 EVM 거래와 Midnight receipt의 정직한 관계 표현이 주요 위험이다.
- **코드 없는 대안**: 기존 EVM 데모에 Midnight 색상과 카피만 입힐 수 있으나, 심사자가 Midnight 구현 포인트를 확인할 수 없어 채택하지 않는다.
- **Kill criteria**: 실제 Compact circuit 실행과 proof 또는 검증 가능한 Local Devnet transaction을 만들 수 없거나, 비공개 필드가 public ledger·로그·URL·브라우저 저장소에 평문으로 노출되면 “프라이버시 DApp” 주장을 중단하고 범위를 재승인한다.
- **Shape 판정**: `GO` — 베이스의 검증 가능한 위임 서사와 Midnight의 private input/public proof 모델이 직접 맞물린다.

## 2. 성공 기준

1. 처음 보는 사용자가 첫 화면에서 10초 안에 “포트폴리오 도구”가 아니라 “증명 가능한 캐릭터 에이전트 관리” 제품임을 이해하고, `Private / Proven / Public` 세 경계를 구분할 수 있다.
2. 사용자가 기존 캐릭터 중 하나를 고르고 비공개 운용 원칙을 맡기면, 공개 ledger에는 캐릭터 ID와 원문 대신 commitment만 남는다.
3. 같은 캐릭터·mandate·시장 snapshot은 항상 같은 판단을 만들고, Compact circuit은 그 판단이 committed character strategy와 mandate를 모두 지켰는지 검증한다.
4. 공개 receipt에는 등록 전략 사용·원칙 준수·재량 내 행동 여부·version·decision identifier만 있고, 캐릭터 ID·목표 비중·허용 이탈폭·자동 실행 임계값·정확한 신뢰 점수와 이력·잔고 원문은 없다.
5. 검증된 실행 이력이 쌓이면 같은 캐릭터의 신뢰와 재량이 규칙대로 변하고, 사용자의 실망 표시는 다음 행동의 재량을 즉시 줄인다.
6. 캐릭터가 proof 결과와 행동 근거를 자기 말투와 상태 표현으로 설명하되 판단이나 proof 입력을 만들지 않는다.
7. README의 명령만으로 새 clone에서 계약 컴파일, circuit 테스트, 웹 빌드, 핵심 데모를 재현할 수 있다.
8. 기존 베이스 검증 6종은 계속 통과하고, Midnight 전용 검증은 이를 대체하지 않고 추가된다.

## 3. 요구사항

### R1. 해커톤 전용 데모 내러티브

**유저스토리:** 심사자로서, 짧은 데모 안에서 캐릭터가 제품의 핵심인 이유와 DriftMate가 Midnight을 쓰는 이유를 함께 이해하기 원한다.

**인수 조건:**
- R1.1 WHEN 사용자가 첫 화면을 열면, THE SYSTEM SHALL 현재 캐릭터와 그 캐릭터가 얻은 재량을 주인공으로 표시하고 `Private`, `Proven`, `Public`에 해당하는 데이터와 역할을 같은 viewport 안에 구분한다.
- R1.2 THE SYSTEM SHALL 실제로 구현된 범위만 설명하고, Midnight이 자산을 보관·교환하거나 EVM 실행을 강제한다고 표현하지 않는다.
- R1.3 WHEN 사용자가 데모를 시작하면, THE SYSTEM SHALL `캐릭터 선택 → 비공개 위임 → 캐릭터 판단·설명 → proof receipt → 신뢰·재량 변화 → 필요 시 owner 결정` 순서를 하나의 진행 흐름으로 안내한다.
- R1.4 THE SYSTEM SHALL 캐릭터를 단순 아바타나 챗봇이 아니라 `고정 전략 + 설명 말투 + 검증된 신뢰·재량 이력`을 가진 에이전트로 설명한다.
- R1.5 THE SYSTEM SHALL 수익을 예측하거나 시장을 직관적으로 읽는 AI라고 주장하지 않는다.

### R2. 비공개 캐릭터 위임

**유저스토리:** 사용자로서, 어떤 캐릭터와 위험 성향을 골랐는지 공개하지 않고도 그 관계와 운용 원칙을 고정하기 위해, 원문 대신 commitment를 남기기를 원한다.

**인수 조건:**
- R2.1 WHEN 사용자가 mandate를 확정하면, THE SYSTEM SHALL 캐릭터 ID, 목표 비중, 허용 이탈폭, 자동 실행 임계값, 누적 예산, 유효 기간을 private input으로 다룬다.
- R2.2 WHEN mandate가 등록되면, THE SYSTEM SHALL 원문을 public ledger에 기록하지 않고 domain-separated commitment와 version identifier만 공개한다.
- R2.3 WHILE mandate가 활성 상태인 동안, THE SYSTEM SHALL 캐릭터 변경을 허용하지 않고 기존 관계를 철회한 뒤 새 commitment를 만들도록 요구한다.
- R2.4 THE SYSTEM SHALL private input을 URL, 분석 이벤트, 콘솔 로그, 오류 메시지, 공개 API 응답에 포함하지 않는다.
- R2.5 WHEN 사용자가 자신의 기기에서 상세 공개를 선택하면, THE SYSTEM SHALL 로컬 private state를 화면에 일시적으로 보여주되 그 행동이 온체인 공개를 뜻하지 않음을 표시한다.
- R2.6 IF private state를 불러올 수 없으면, THEN THE SYSTEM SHALL 증명 생성을 중단하고 재설정 경로를 제공하며 임의의 기본값으로 대체하지 않는다.

### R3. 캐릭터 정체성과 전략 일관성

**유저스토리:** 사용자로서, 캐릭터가 단순 스킨이 아니라 앞으로의 행동을 예측할 수 있는 약속이 되도록, 캐릭터마다 변하지 않는 전략과 검증 가능한 이력을 원한다.

**인수 조건:**
- R3.1 THE SYSTEM SHALL 기존 두 캐릭터를 제공하고 각 캐릭터를 정확히 하나의 immutable strategy version에 연결한다.
- R3.2 THE SYSTEM SHALL 사용자가 캐릭터의 전략 파라미터를 개별 수정하지 못하게 하며, 다른 행동 성향은 다른 캐릭터 선택으로만 제공한다.
- R3.3 WHEN proof를 검증하면, THE SYSTEM SHALL private character ID를 공개하지 않고 committed character가 등록된 전략 중 하나이며 해당 전략 version대로 판단했음을 증명한다.
- R3.4 THE SYSTEM SHALL 같은 character version을 결정 엔진, proof 입력, 화면의 성향 설명에 사용하고 서로 다르면 실행을 중단한다.
- R3.5 THE SYSTEM SHALL LLM과 Live2D를 이미 검증된 판단의 설명과 표현에만 사용하고 거래 방향·금액·proof 판정을 생성하거나 수정하지 못하게 한다.
- R3.6 WHEN 손실 또는 사용자 실망 상태를 표현하면, THE SYSTEM SHALL 손실 수치를 캐릭터 반응보다 먼저 표시하고 조롱·축소·처벌을 연상시키는 표현을 사용하지 않는다.

### R4. 결정론적 판단 재사용

**유저스토리:** 사용자로서, 프라이버시가 판단 규칙을 불투명하게 만들지 않도록, 기존과 같은 입력에는 같은 판단이 나오기를 원한다.

**인수 조건:**
- R4.1 THE SYSTEM SHALL 기존 `packages/engine`의 결정론적 계산을 재사용하고, Midnight adapter 안에 별도의 거래 판단 알고리즘을 복제하지 않는다.
- R4.2 WHEN 동일한 character version, mandate, 가격 snapshot, 잔고, 비용 견적을 입력하면, THE SYSTEM SHALL 동일한 decision identifier와 거래 제안을 만든다.
- R4.3 THE SYSTEM SHALL 네트워크, 시스템 시각, 난수, LLM, 신뢰 점수를 거래 방향 또는 금액 계산에 사용하지 않는다.
- R4.4 WHEN proof용 입력을 만들면, THE SYSTEM SHALL 엔진 결과와 Compact 입력 사이의 변환을 명시적으로 검증하고 정밀도 손실 또는 범위 초과를 거부한다.

### R5. Midnight 규칙 준수 증명

**유저스토리:** 검증자로서, 숨겨진 투자 원칙을 보지 않고도 제안이 그 원칙을 따랐는지 확인하기 위해, Midnight proof receipt를 원한다.

**인수 조건:**
- R5.1 WHEN 제안이 committed character와 mandate의 version에 일치하고 캐릭터 전략·허용 이탈폭·임계값·누적 예산·유효 기간 규칙을 만족하면, THE SYSTEM SHALL Compact circuit 검증을 통과시키고 공개 receipt를 갱신한다.
- R5.2 IF 제안이 commitment와 다른 캐릭터 또는 mandate를 사용하거나 전략·한도·예산·유효 기간을 위반하면, THEN THE SYSTEM SHALL proof 생성을 실패시키고 public success receipt를 남기지 않는다.
- R5.3 THE SYSTEM SHALL receipt를 character-mandate commitment, decision identifier, 판정 상태, strategy version, circuit version에 결합해 다른 캐릭터·mandate·decision에 재사용할 수 없도록 한다.
- R5.4 THE SYSTEM SHALL public ledger와 transaction output에 R2.1의 원문 값과 정확한 신뢰 점수·관계 이력이 나타나지 않음을 자동 검사한다.
- R5.5 WHEN 증명 또는 제출이 진행 중이면, THE SYSTEM SHALL 단계를 구분한 상태를 보여주고 중복 제출을 막는다.

### R6. 신뢰·재량과 owner 통제

**유저스토리:** owner로서, 캐릭터가 실적으로 얻은 재량 안에서만 행동하게 하고 필요할 때 관계의 신뢰를 직접 줄이기를 원한다.

**인수 조건:**
- R6.1 THE SYSTEM SHALL 기존 검증 가능한 실행 효율·거절·예산 소진·owner 실망 기록만으로 캐릭터 신뢰와 재량을 계산하고 접속 횟수·결제·시장 수익률을 사용하지 않는다.
- R6.2 THE SYSTEM SHALL 신뢰를 거래 방향·목표 비중·거래 금액 계산에 사용하지 않고 자동 실행 자격 경계만 좁히거나 넓힌다.
- R6.3 WHEN 거래 제안이 private auto threshold와 현재 캐릭터 재량 이하이면, THE SYSTEM SHALL receipt를 `proved_auto_eligible`로 표시할 수 있다.
- R6.4 WHEN 거래 제안이 둘 중 낮은 경계를 초과하면, THE SYSTEM SHALL 자동 적격으로 표시하지 않고 owner 결정 대기 상태를 증명한다.
- R6.5 WHEN owner가 대기 제안을 승인·거절하거나 실망을 표시하면, THE SYSTEM SHALL owner secret과 정확한 신뢰 변화 원문을 공개하지 않고 해당 캐릭터·decision에 묶인 결과를 기록한다.
- R6.6 WHEN owner가 실망을 표시하면, THE SYSTEM SHALL 다음 판단부터 캐릭터 재량을 즉시 줄이고 이후 검증된 실적으로만 회복시킨다.
- R6.7 THE SYSTEM SHALL Midnight receipt가 기존 `AgentVault`의 executor, 자산·DEX allowlist, 만료, 1회 상한, 누적 예산, owner-only withdrawal 강제를 대체한다고 주장하거나 구현하지 않는다.
- R6.8 THE SYSTEM SHALL Midnight proof 실패 또는 부재를 성공적인 정책 준수로 표시하지 않는다.
- R6.9 THE SYSTEM SHALL 실제 EVM 거래와 연결할 경우 EVM transaction과 Midnight receipt를 서로 다른 체인의 증거로 명확히 구분한다.

### R7. 캐릭터 중심 프라이버시 인터페이스

**유저스토리:** 사용자로서, 복잡한 ZK 용어보다 내가 맡긴 캐릭터의 현재 상태와 다음 행동을 중심으로 관계를 관리하기 원한다.

**인수 조건:**
- R7.1 THE SYSTEM SHALL 캐릭터 stage, 현재 신뢰·재량, 캐릭터의 최근 설명, 다음 owner 행동을 첫 화면의 주 시각 계층으로 둔다.
- R7.2 WHEN private 값이 화면에 표시되면, THE SYSTEM SHALL `이 기기에서만 보임` 상태를 시각·텍스트 양쪽으로 표시한다.
- R7.3 WHEN proof가 완료되면, THE SYSTEM SHALL 캐릭터의 상태 변화와 함께 공개된 필드와 숨겨진 필드를 receipt 옆에서 비교할 수 있게 표시한다.
- R7.4 WHEN 증명·승인 대기·실행·손실·실망 상태가 바뀌면, THE SYSTEM SHALL 캐릭터의 허용된 표정과 말투로 반영하되 사실 수치와 proof 상태를 가리지 않는다.
- R7.5 THE SYSTEM SHALL 모바일 360px부터 데스크톱 1440px까지 수평 페이지 스크롤 없이 핵심 흐름을 사용할 수 있게 한다.
- R7.6 THE SYSTEM SHALL 모든 대화형 요소에 keyboard focus, pressed/disabled/loading/error 상태와 4.5:1 이상의 본문 명도 대비를 제공한다.
- R7.7 THE SYSTEM SHALL `prefers-reduced-motion`에서 장식 애니메이션을 제거하고 기능 상태 전달을 애니메이션에만 의존하지 않는다.

### R8. 제출 재현성과 정직한 문서

**유저스토리:** 심사자로서, 저장소를 클론한 뒤 설명과 같은 결과를 확인하기 위해, 짧고 실패가 명확한 실행 절차를 원한다.

**인수 조건:**
- R8.1 THE SYSTEM SHALL README에 제품 한 줄 설명, 캐릭터 관리 루프, private/proven/public 표, Midnight 구현 지점, 사전 요구사항, 로컬 실행, 테스트, 90초 데모 시나리오를 제공한다.
- R8.2 WHEN 필수 SDK, proof server, wallet 또는 환경값이 없으면, THE SYSTEM SHALL 누락 항목과 설정 명령을 구체적으로 보고하고 가짜 성공 데이터로 대체하지 않는다.
- R8.3 THE SYSTEM SHALL Compact contract의 성공·위반·다른 캐릭터 대입·재사용 공격·비공개 값 누출 검사를 자동화한다.
- R8.4 THE SYSTEM SHALL 해커톤 제출 폼과 README에서 동일한 제품명, 한 줄 설명, 캐릭터 차별점, Midnight 구현 포인트를 사용한다.
- R8.5 THE SYSTEM SHALL 기존 `pnpm test`, `pnpm typecheck`, 웹 build, Foundry tests, E2E를 유지하고 Midnight 전용 compile/test/demo 검증을 추가한다.

## 4. Invariants / Contracts / NFR

- `AGENTS.md`의 9개 베이스 목표 계약은 그대로 유지한다. 이 spec은 체인 전용 확장이며 `packages/engine`과 `packages/shared`에 행사명, 체인 ID, API URL, 런타임 종속성을 넣지 않는다.
- 캐릭터는 고정 strategy version과 검증된 관계 이력을 가진 제품 주체다. 같은 전략에 이름과 표정만 바꾸는 cosmetic skin으로 구현하지 않는다.
- Midnight private state는 사용자의 기기 경계를 벗어나지 않는다. 서버 또는 Keeper가 원문을 받아 보관하는 설계는 허용하지 않는다.
- proof receipt는 규칙 준수를 증명하지만 자산 수탁, 수익 보장, Midnight에서의 실제 swap을 뜻하지 않는다.
- 새 런타임 의존성은 공식 Midnight SDK와 현재 스택에 필요한 최소 패키지로 제한하며, 기존 패키지가 해결하는 UI 문제에 새 라이브러리를 추가하지 않는다.
- 핵심 proof flow는 지원 개발 환경에서 p95 30초 안에 완료되어야 한다. 측정이 불가능하면 시간을 만들어내지 않고 실측 불가로 표시한다.
- 모든 주소 비교가 필요한 EVM 경로는 기존 `normalizeAddress`를 사용한다.
- 라이선스가 불명확한 행사 로고·폰트·이미지를 복사하지 않고, 제품 고유 시각 체계를 사용한다.

## 5. Acceptance Checklist

- [x] 모든 필수 요구사항에 ID와 관측 가능한 검증 기준이 있다.
- [x] scope와 non-goals가 충돌하지 않는다.
- [x] 해커톤의 저장소 빌드, README 일치, Midnight 구현, 데모 확인 기준을 반영했다.
- [x] 베이스 안전 계약과 Midnight privacy claim의 경계를 명시했다.
- [x] 사용자가 제품 범위와 성공 기준을 승인했다.

## 6. Sources

- [Midnight Korea Hackathon 2026](https://www.hackathon.midnightkorea.org/kor)
- [Midnight Korea Hackathon 2026 Luma](https://luma.com/2pnv2fwk)
- [Compact as a privacy-first language](https://docs.midnight.network/concepts/how-midnight-works/compact-privacy-first-language)
- [Private party contract](https://docs.midnightkorea.org/tutorials/private-party/smart-contract)
- [Test and debug](https://docs.midnightkorea.org/compact/test-and-debug)
