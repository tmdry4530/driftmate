---
feature: binance-agent-os-track-a
status: approved
created: 2026-09-04
updated: 2026-09-04
related:
  - requirements.md
  - design.md
  - ../adr/0007-binance-market-context-boundary.md
---

# Binance Agent OS Track A — 태스크

- [x] **B001. 읽기 전용 DriftMate 스킬**
  - `skills/driftmate/SKILL.md`를 Binance Skills Hub 형식으로 작성한다.
  - 기존 `GET /status`와 Binance Agent OS market data만 사용한다.
  - 승인, 거래, 이체, 비밀정보 요청을 명시적으로 차단한다.
  - 요구사항: BA1.1~BA3.4.
  - 검증: `quick_validate.py`, `npx skills add . --list --full-depth`.

- [x] **B002. Track A 데모와 제출 문서**
  - 설치·실행·Agent OS 연결·3분 데모·제출 체크리스트를 작성한다.
  - 루트 README에서 행사 문서로 연결한다.
  - 요구사항: BA4.1.
  - 검증: 문서 링크와 명령 dry-run.

- [x] **B003. 베이스 회귀 검증과 증거**
  - 스킬의 쓰기 권한 금지와 코어 미변경을 확인한다.
  - 베이스 전체 검증을 실행하고 evidence/state/traceability를 완료한다.
  - 요구사항: BA4.2~BA4.3 및 전체.
  - 검증: `pnpm test`, `pnpm typecheck`, `pnpm --filter @soon/web build`, `pnpm contracts:test`, `pnpm e2e`.
