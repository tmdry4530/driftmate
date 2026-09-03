---
feature: binance-agent-os-track-a
status: approved
created: 2026-09-04
updated: 2026-09-04
related:
  - design.md
  - tasks.md
  - ../adr/0007-binance-market-context-boundary.md
  - ../character-agent-rebalancer/requirements.md
---

# Binance Agent OS Track A — 요구사항

## 목표

DriftMate를 Binance Agent OS Mini Hackathon의 **Track A: AI agent 빌드** 제출물로 패키징한다. 기존 AgentVault·결정론적 엔진·Keeper가 거래를 판단하고 강제하는 구조는 그대로 두고, Binance Agent OS는 사용자가 현재 상태를 이해하도록 돕는 읽기 전용 시장 맥락에만 쓴다.

핵심 메시지는 다음 한 문장이다.

> Binance Agent OS가 시장을 연결하고, DriftMate가 에이전트의 행동 가능 범위를 검증한다.

## Non-goals

- Binance MCP의 Trade·Transfer·Account 쓰기 권한 사용
- Binance Agentic sub-account에서의 실제 거래
- Binance 시장 데이터를 리밸런싱 판단, 목표 비중, 주문 금액 또는 승인 Gate에 입력
- 새 런타임, 에이전트 프레임워크 또는 MCP 클라이언트 구현
- 메인넷 배포와 실자금 사용

## 요구사항

### BA1. Agent OS 호환 에이전트 패키지

- BA1.1 THE PROJECT SHALL Binance Skills Hub 형식의 `driftmate` 스킬을 제공한다.
- BA1.2 WHEN 사용자가 DriftMate 세션 검토를 요청하면, THE SKILL SHALL 기존 Keeper의 `GET /status`를 읽고 위임·판단·승인 대기·손익 상태를 요약한다.
- BA1.3 THE SKILL SHALL DriftMate의 변경 API를 호출하거나 컨트랙트 트랜잭션을 제출하지 않는다.

### BA2. Binance 시장 맥락

- BA2.1 WHEN 대상 토큰이 식별 가능하고 Binance Agent OS 시장 데이터 도구를 사용할 수 있으면, THE SKILL SHALL Binance MCP의 읽기 전용 시장 데이터 또는 공식 `query-token-info` 스킬로 현재 시장 맥락을 조회한다.
- BA2.2 THE SKILL SHALL Binance 관측값을 온체인 판단 근거와 분리해 출처와 관측 시각이 있는 참고 정보로 표시한다.
- BA2.3 IF Binance 시장 데이터를 조회할 수 없거나 토큰을 확정할 수 없으면, THEN THE SKILL SHALL 그 사실을 명시하고 DriftMate 상태 요약은 계속 제공한다.

### BA3. 실행·권한 경계

- BA3.1 THE SYSTEM SHALL Binance 시장 데이터를 `packages/engine`, `AgentVault`, Keeper의 주문·Gate 입력으로 전달하지 않는다.
- BA3.2 THE SKILL SHALL Binance Trade·Transfer 도구를 호출하거나 API 키·MCP endpoint·개인키·니모닉을 대화에 붙여 넣도록 요청하지 않는다.
- BA3.3 WHEN 승인 대기 주문이 있으면, THE SKILL SHALL 금액·초과분·거래 방향·만료를 설명하고 owner가 DriftMate 웹에서 직접 검토하도록 안내할 뿐 승인하지 않는다.
- BA3.4 THE SKILL SHALL 가격 방향 예측, 수익 보장 또는 매수·매도 권유를 하지 않는다.

### BA4. 제출 가능성

- BA4.1 THE PROJECT SHALL Agent OS 연결, 로컬 실행, 3분 데모 흐름과 제출 체크리스트를 하나의 행사 문서로 제공한다.
- BA4.2 THE PROJECT SHALL 기존 베이스 검증 명령을 삭제하거나 완화하지 않는다.
- BA4.3 WHEN 스킬을 배포 전 검증하면, THE PROJECT SHALL frontmatter·이름·미완성 placeholder가 없는지 자동 검사하고 패키지 검색 결과에서 `driftmate`가 발견되어야 한다.

## 인수 조건

1. `skills/driftmate/SKILL.md`가 공식 Skills Hub 구조 검사를 통과한다.
2. 로컬 패키지 검색이 `driftmate`를 한 개의 설치 가능한 스킬로 찾는다.
3. 스킬 지침상 Binance 쓰기 도구와 DriftMate 변경 경로는 모두 금지된다.
4. Agent OS 장애 시에도 기존 온체인 판단·실행에는 영향이 없다.
5. 베이스 전체 테스트·타입검사·웹 빌드·Solidity 테스트·Anvil E2E가 유지된다.
