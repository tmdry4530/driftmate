# ADR-0007: Binance Agent OS는 읽기 전용 시장 맥락에만 쓴다

- **날짜**: 2026-09-04
- **상태**: 승인됨
- **관련 기능**: binance-agent-os-track-a, character-agent-rebalancer
- **관련 요구사항**: BA1~BA4, R4.1, R4.8, R6.2, R8.2

## 맥락

Track A 제출물은 Binance Agent OS를 실제로 사용해야 한다. 동시에 DriftMate의 핵심 계약은 외부 AI와 데이터가 거래 방향·목표 비중·금액·승인 Gate를 바꾸지 못하게 한다. Binance MCP 거래를 Keeper에 직접 연결하면 AgentVault와 별개의 두 번째 실행 경로가 생기고 이 계약이 깨진다.

## 대안

1. **Binance MCP Trade로 실제 주문 실행** — Track B에는 적합하지만 DriftMate의 온체인 볼트·직접 owner 승인·트랙레코드를 우회한다.
2. **Binance 시장 데이터를 엔진의 가격 입력으로 사용** — 통합은 눈에 띄지만 실행 DEX와 다른 가격이 판단을 바꾸며 결정 재현과 ADR-0002를 훼손한다.
3. **Agent OS를 설명 계층의 읽기 전용 시장 맥락으로 사용** — 기존 판단·실행 경계를 보존하면서 Agent OS 연결을 사용자가 직접 확인할 수 있다.

## 결정

**3번을 채택한다.** Binance Agent OS의 market-data 도구 또는 공식 `query-token-info` 스킬은 DriftMate 상태를 설명할 때만 호출한다. 결과는 출처와 시각을 붙인 참고 맥락으로 분리하고, 거래 판단·승인·실행 입력으로 전달하지 않는다.

Binance 권한은 Market data로 제한한다. Trade, Transfer와 Account 쓰기는 사용하지 않는다. owner 승인 요청은 기존 DriftMate 웹과 AgentVault 직접 서명 경로로만 처리한다.

## 결과

- Track A의 AI agent 제출 형식을 충족하면서 베이스의 안전 계약을 유지한다.
- Agent OS 장애나 인증 만료가 Keeper 운용을 멈추거나 바꾸지 않는다.
- Binance에서 실거래량을 만들어야 하는 Track B에는 참여하지 않는다.
- 향후 Track B를 선택하려면 별도 위임 모델과 이중 실행 원천 문제를 먼저 설계해야 한다.
