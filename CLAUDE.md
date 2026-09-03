# soon — 캐릭터 에이전트 리밸런서

애니 캐릭터 AI가 온체인 포트폴리오를 리밸런싱하는 제품. spec은 `.claude/specs/character-agent-rebalancer/`.

## 구조

```
packages/shared     타입 전용. 런타임 값을 두지 않는다
packages/engine     순수 함수 (판단·신뢰·게이트). 런타임 의존성 0
packages/contracts   Foundry. 한도 강제의 최종 방어선
apps/keeper         자동 실행 프로세스
apps/web            Vite + React + wagmi
```

## 명령

```bash
pnpm test               # TS 유닛 + 타입 테스트
pnpm typecheck
pnpm contracts:test     # forge test
pnpm e2e                # Anvil 띄우고 최소 루프 완주 검증
KEEP=1 pnpm e2e         # 검증 후 체인·실행자를 띄운 채로 둔다 (.env 자동 갱신)
pnpm live2d:setup [ZIP] # Cubism SDK for Web을 로컬 자산으로 설치·빌드
pnpm -C apps/web dev
```

Live2D SDK와 생성 자산은 라이선스 때문에 Git에 넣지 않는다. SDK ZIP을 다시 받았거나 생성 자산이 없으면 `live2d:setup`을 실행한다.

Foundry가 없으면 `curl -L https://foundry.paradigm.xyz | bash && foundryup`.

## 지켜야 할 것

**주소는 반드시 정규화해서 비교한다.** viem은 읽기에서 체크섬 주소를, 배포 영수증에서 소문자 주소를 준다. `===`나 `Set.has`로 직접 비교하면 같은 자산을 다른 자산으로 취급한다. 이 프로젝트에서 같은 버그를 두 번 만났고 — 한 번은 비중 계산 전체가, 한 번은 슬리피지 검출이 무너졌다 — **목 객체 테스트로는 절대 드러나지 않는다.** `normalizeAddress`를 쓸 것.

**엔진에 런타임 의존성을 넣지 않는다.** `packages/engine`의 `dependencies`가 비어 있는 것이 결정론의 방어선이다. 네트워크·시계·난수가 들어올 통로를 아예 없앤다. `purity.test.ts`가 이걸 검사한다.

**판단 함수에 신뢰 점수를 넘기지 않는다.** `DecisionInput`에 자리가 없는 것이 의도다. 신뢰는 "무엇을 거래할지"가 아니라 "물어볼지 알아서 할지"만 바꾼다.

**성과를 수익률로 재지 않는다.** 순성과 = 거래 규모 대비 마찰비용(슬리피지 + 운영비) 비율. 리밸런싱 스왑은 그 자체로 손익이 없고, 포트폴리오 가치 변화는 시장이 움직인 결과지 캐릭터의 성과가 아니다.

**차감 전 수치를 단독으로 띄우지 않는다.** 화면의 대표값은 항상 운영비를 포함한다.

## 테스트를 쓸 때

**합산 지표 하나로 검증하지 않는다.** "마찰이 계산됨"은 구성요소 중 하나가 0이어도 통과한다. 슬리피지와 운영비를 각각 확인해야 한다 — 이 프로젝트에서 실제로 그렇게 버그를 통과시켰다.

## 포트

로컬에 다른 프로젝트가 흔한 포트를 쓰고 있어 전용 포트를 쓴다. `strictPort`와 IPv4 명시 바인딩을 유지할 것 — 조용히 다른 포트로 옮겨가거나 IPv6에만 붙으면 엉뚱한 앱을 보게 된다.

| 용도 | 포트 |
|---|---|
| web dev | 5273 |
| E2E Anvil | 8546 |
| keeper API | 8945 |

## 실자금 전에 반드시

`design.md`의 미해결 항목을 확인한다. 특히 **컨트랙트 감사**, **가격 조작 저항(TWAP/오라클)**, **직접 dust 전송을 제외하는 managed balance**가 선행되어야 한다. 승인·거절은 API가 아니라 owner 지갑의 온체인 호출만 사용한다.
