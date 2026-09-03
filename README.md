# DriftMate (`soon`)

캐릭터의 성향을 결정론적 온체인 리밸런싱 전략으로 사용하는 비수탁형 에이전트 프로젝트다. 사용자는 격리 볼트의 owner로 남고, Keeper는 사용자가 서명한 자산·DEX·기간·금액 한도 안에서만 동작한다. LLM과 Live2D는 판단을 바꾸지 않고 설명과 표현만 담당한다.

현재 제품 계약과 구현 순서는 [기획서](./.claude/specs/character-agent-rebalancer/idea-proposal.md), [요구사항](./.claude/specs/character-agent-rebalancer/requirements.md), [설계](./.claude/specs/character-agent-rebalancer/design.md), [태스크](./.claude/specs/character-agent-rebalancer/tasks.md)에 있다.

## 빠른 시작

필수 환경은 Git, Node.js 20 이상과 Corepack이다. 비공개 저장소를 읽을 수 있는 GitHub SSH 인증이 필요하다.

```bash
git clone git@github.com:tmdry4530/driftmate.git
cd driftmate
corepack enable
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm --filter @soon/web build
```

웹만 실행할 때는 환경 예시를 복사하고 필요한 주소를 채운다.

```bash
cp apps/web/.env.example apps/web/.env
pnpm -C apps/web dev
```

## 컨트랙트와 통합 환경

[Foundry](https://book.getfoundry.sh/getting-started/installation)가 설치된 환경에서 의존성을 복원한다.

```bash
pnpm contracts:setup
pnpm contracts:test
pnpm e2e
```

E2E가 만든 Anvil과 Keeper를 유지해 웹에서 확인하려면 두 터미널에서 각각 실행한다.

```bash
KEEP=1 pnpm e2e
pnpm -C apps/web dev
```

## Live2D

Live2D 없이도 정적 SVG 폴백으로 개발할 수 있다. Haru·Ren 모델을 렌더링하려면 시스템 `unzip`과 Cubism SDK for Web ZIP이 필요하다. ZIP을 공식 배포처에서 받은 뒤 로컬 설치 명령을 실행한다.

```bash
pnpm live2d:setup /path/to/CubismSdkForWeb-5-r.5.zip
```

SDK, 샘플 모델과 생성된 runtime은 라이선스 때문에 Git에 포함하지 않는다.

## 커스터마이징 지점

| 목적 | 위치 |
|---|---|
| 캐릭터 전략 파라미터 | `packages/engine/src/characters.ts` |
| 결정 규칙과 승인 Gate | `packages/engine/src/decide.ts`, `packages/engine/src/gate.ts` |
| 볼트 권한·한도 | `packages/contracts/src/AgentVault.sol` |
| 자동 실행 파이프라인 | `apps/keeper/src/keeper.ts` |
| 캐릭터 UI와 상태 표현 | `apps/web/src/components/CharacterStage.tsx`, `apps/web/src/characterState.ts` |
| 체인·컨트랙트 주소 | `apps/web/.env.example` |

새 기능은 `.claude/specs/<feature-name>/`에서 requirements → design/ADR → tasks 순서로 합의한 뒤 구현한다. 메인넷 실자금 사용 전에는 설계 문서의 보안 미해결 항목을 먼저 닫아야 한다.
