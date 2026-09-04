# Binance Agent OS Mini Hackathon — Track A 제출 가이드

## 선택한 트랙

**Track A: Agent OS로 AI 에이전트 빌드**로 제출한다.

DriftMate는 이미 결정론적 판단, 제한 위임, owner 직접 승인, 온체인 트랙레코드, 캐릭터 설명을 가진 완성된 에이전트 흐름이다. Track B의 실거래량 경쟁을 위해 별도 Binance 실행 경로를 만드는 것보다, Track A에서 Agent OS 시장 연결과 DriftMate의 검증 가능한 권한 경계를 결합하는 편이 제품 정체성과 안전 계약에 맞는다.

제출 메시지:

> Binance Agent OS connects the market. DriftMate proves when an agent is allowed to act.

제출 링크:

- 공개 저장소: <https://github.com/tmdry4530/driftmate/tree/hackathon/binance-agent-os>
- 81초 데모: <https://github.com/tmdry4530/driftmate/releases/download/hackathon-binance-agent-os-v1/driftmate-binance-agent-os-track-a.mp4>

## Agent OS 연결

1. 공식 Binance Skills Hub를 설치한다.

   ```bash
   npx skills add https://github.com/binance/binance-skills-hub --skill query-token-info -y
   ```

2. 이 저장소의 `driftmate` 스킬을 프로젝트 에이전트에 설치한다.

   ```bash
   npx skills add . --skill driftmate -y
   ```

3. [Binance MCP 공식 연결 안내](https://developers.binance.com/en/docs/agent-native/mcp-server/agentic)에 따라 지원 클라이언트에서 연결하고 **Market data** 권한만 허용한다. endpoint나 인증 정보를 채팅에 붙여 넣지 않는다.

`query-token-info`만으로 데모할 때는 MCP OAuth 없이 공식 Skills Hub의 공개 시장 데이터 경로를 사용할 수 있다. 어느 쪽이든 DriftMate 주문·승인에는 연결되지 않는다.

## 로컬 데모 실행

필수 의존성을 설치하고 전체 검증을 먼저 실행한다.

```bash
pnpm install --frozen-lockfile
# 새 clone에서만 한 번
pnpm contracts:setup
pnpm test
pnpm typecheck
pnpm contracts:test
pnpm --filter @soon/web build
pnpm e2e
```

데모 환경은 두 터미널에서 실행한다. 첫 명령은 Anvil·Keeper를 유지하고 `apps/web/.env`를 자동 생성한다.

```bash
KEEP=1 pnpm e2e
```

```bash
pnpm -C apps/web dev
```

로컬 에이전트 프롬프트 예시:

```text
Use DriftMate to review the current session at http://127.0.0.1:8945/status.
Add Binance Agent OS market context for BNB on BSC, but keep it separate because
the local E2E asset is a mock token. Do not trade, transfer, or approve anything.
```

## 3분 데모 흐름

1. **0:00–0:25 문제** — AI가 거래를 추천하는 것보다, 무엇을 할 수 있는지 검증하는 일이 먼저라고 설명한다.
2. **0:25–0:55 캐릭터 위임** — 캐릭터별 고정 전략과 owner가 서명하는 자산·DEX·기간·상한·예산을 보여준다.
3. **0:55–1:25 자동 실행** — 작은 리밸런싱과 온체인 `Decided`·`Executed`·비용 기록을 보여준다.
4. **1:25–1:55 승인 경계** — 한도를 넘은 주문이 멈추고, Agent OS가 아니라 owner 지갑만 직접 승인할 수 있음을 보여준다.
5. **1:55–2:25 Agent OS** — `driftmate` 스킬이 `/status`와 Binance 시장 데이터를 별도 구역으로 설명하는 모습을 보여준다.
6. **2:25–2:50 손실·신뢰** — 세션 기준점, 운영비 포함 손익, 실망 기록에 따른 재량 축소를 보여준다.
7. **2:50–3:00 결론** — “connected by Binance, constrained by code, verified on-chain”으로 끝낸다.

## 녹화 전 체크리스트

- [ ] 저장소 URL과 3분 이하 데모 영상 URL 준비
- [ ] `skills/driftmate/SKILL.md`가 저장소에서 보임
- [ ] Binance MCP 또는 `query-token-info` 호출 흔적이 영상에 보임
- [ ] Binance 데이터가 주문 판단과 분리됐다는 설명 포함
- [ ] owner 직접 승인과 출금 권한 부재를 화면에서 확인
- [ ] 실자금이 아닌 로컬 Anvil 데모임을 표시
- [ ] `pnpm test`, `typecheck`, 웹 빌드, Forge, E2E 통과 화면 준비
- [ ] 공개 공지의 팔로우·리포스트·답글 및 제출 설문 완료

마감은 **2026-09-08 23:59 UTC / 2026-09-09 08:59 KST**다. 제출 직전 공식 공지와 설문에서 자격 지역, 링크 형식, 필수 계정 정보를 다시 확인한다.
