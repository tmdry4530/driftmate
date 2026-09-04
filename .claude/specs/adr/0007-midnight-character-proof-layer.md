---
adr: 0007
status: approved
created: 2026-09-04
related:
  - ../midnight-private-mandate/requirements.md
  - ../midnight-private-mandate/design.md
  - 0001-delegation-model.md
  - 0003-trust-score-location.md
---

# ADR-0007: Midnight는 캐릭터 정책 증명 레이어로 사용한다

- **날짜**: 2026-09-04
- **상태**: 승인됨
- **관련 기능**: midnight-private-mandate
- **관련 요구사항**: R1.2, R3.3, R5, R6.7~R6.9

## 맥락

DriftMate의 기존 실행 경계는 EVM `AgentVault`다. Midnight 해커톤에서 선택적 공개를 보여주려면 캐릭터 선택, 목표 비중, 자동 실행 한도, 신뢰 관계를 private input으로 다뤄야 한다. 그러나 Midnight가 EVM 거래를 직접 강제한다고 주장하려면 proof relay와 EVM verifier가 필요하며, 이는 현재 기한과 검증 범위를 크게 넘는다.

캐릭터를 제거하고 단순 private portfolio proof만 만들면 기존 제품의 차별점도 사라진다. 따라서 Midnight의 역할과 캐릭터의 역할을 동시에 좁고 정직하게 정해야 한다.

## 검토한 대안

1. **기존 EVM 앱에 Midnight 시각 브랜딩만 추가** — 변경이 작지만 Compact contract와 실제 proof가 없어 해커톤의 Midnight 구현 기준을 충족하지 못한다.
2. **모든 자산·거래를 Midnight-native로 이전** — privacy 서사는 가장 강하지만 현재 검증된 DEX·가격·볼트 흐름을 버리고 새 금융 실행 계층을 만들어야 한다. 베이스 계약과 마감에 비해 범위가 크다.
3. **Midnight proof를 EVM에서 검증하는 cross-chain 실행** — private policy가 EVM 실행을 직접 제한하지만 relay, finality, verifier, replay, 장애 복구가 새로운 자금 보안 경계가 된다.
4. **캐릭터 정책의 private pre-trade proof layer** — 기존 엔진이 제안하고 Compact가 숨겨진 캐릭터·mandate·재량 규칙 준수를 증명한다. EVM 실행과는 별도 receipt로 남긴다.

## 결정

**4번을 채택한다.** Midnight는 캐릭터와 사용자의 private relationship을 보관·검증하는 계층이고, EVM `AgentVault`는 기존 자산 권한과 공개 한도의 최종 강제 지점으로 남는다.

공개 claim은 “등록된 캐릭터가 committed mandate와 현재 재량 안에서 행동했음을 Midnight가 증명한다”까지다. “Midnight가 EVM 거래를 실행했다”, “Midnight proof가 EVM 볼트를 직접 잠갔다”, “EVM outcome inclusion을 증명했다”는 표현은 금지한다.

## 결과

- character ID, 목표 비중, 정확한 한도·신뢰 점수는 private state에 남고 public ledger에는 commitment와 최소 receipt만 기록된다.
- 기존 캐릭터·엔진·신뢰 모델을 재사용하므로 프로젝트 정체성을 유지한다.
- 실제 proof 생성과 Local Devnet transaction으로 Midnight 구현을 보여줄 수 있다.
- EVM 거래와 Midnight receipt 사이에는 암호학적 cross-chain enforcement가 없다. UI와 README가 이 경계를 항상 표시해야 한다.
- 향후 cross-chain verifier를 붙이려면 별도 L3 spec과 보안 검토가 필요하다. 이번 구현은 그 인터페이스를 미리 만들지 않는다.
