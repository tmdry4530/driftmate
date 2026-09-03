# DriftMate 베이스 계약

이 파일은 저장소 전체에 적용된다. `main`은 특정 해커톤, 빌더 프로그램, 체인에 종속되지 않는 기준 제품이다.

## 브랜치 역할

- `main`: 재사용 가능한 체인 중립 베이스만 둔다.
- `hackathon/<name>`, `program/<name>`, `chain/<name>`: 행사, 스폰서, 체인별 기능을 붙인다.
- 확장은 설정, 어댑터, 배포 스크립트, UI 브랜딩으로 격리한다. 베이스 코어를 복사해 별도 구현하지 않는다.
- 브랜치 전용 주소, 체인 ID, API URL, 스폰서 이름을 `packages/engine`이나 `packages/shared`에 넣지 않는다.

## 변경할 수 없는 목표 계약

1. 사용자가 볼트 owner로 남는다. Keeper와 외부 서비스는 출금 권한을 갖지 않는다.
2. `AgentVault`가 executor, 허용 자산·DEX, 만료, `autoThreshold`, 1회 거래 상한, 누적 예산을 최종 강제한다. `autoThreshold`를 넘는 주문은 owner의 온체인 직접 승인만 허용한다.
3. `packages/engine`은 런타임 의존성 없이 결정론적으로 동작한다. 네트워크, 시스템 시각, 난수, LLM을 읽지 않는다.
4. 신뢰는 자동 실행 여부만 바꾼다. 거래 방향, 목표 비중, 거래 금액 계산에는 들어가지 않는다.
5. 온체인 위임 상태가 단일 진실 원천이다. UI나 Keeper에 더 느슨한 별도 권한 설정을 만들지 않는다.
6. LLM과 Live2D는 설명과 표현만 담당한다. 판단이나 실행 인자를 생성·수정하지 않는다.
7. 주소 비교에는 기존 `normalizeAddress`를 사용한다.
8. `packages/shared`는 타입 전용으로 유지하고 런타임 값을 두지 않는다.
9. 비밀키, 니모닉, `.env`, Live2D SDK·모델 같은 라이선스 자산은 커밋하지 않는다.

이 계약을 바꾸는 작업은 구현 전에 `.claude/specs/<feature-name>/`의 requirements(EARS) → design/ADR → tasks를 갱신하고 사용자 승인을 받는다. 해커톤 마감이나 체인 요구사항은 계약 완화 사유가 아니다.

이 목록은 현재 구현이 완료됐다는 선언이 아니다. 온체인 pending과 owner 직접 승인, `autoThreshold`의 컨트랙트 강제, ERC-20 실패 반환 처리 등 승인된 미완료 작업이 남아 있다. `.claude/specs/character-agent-rebalancer/tasks.md`의 T10과 인수 조건을 끝내기 전에는 실자금을 사용하지 않는다.

## 완료 조건

브랜치의 변경은 아래 검증을 모두 통과해야 한다. 테스트를 삭제하거나 완화해서 통과시키지 않는다.

```bash
pnpm test
pnpm typecheck
pnpm --filter @soon/web build
pnpm contracts:setup     # 새 clone에서 최초 1회
pnpm contracts:test
pnpm e2e
```

`.github/workflows/base-contract.yml`을 모든 브랜치에서 유지한다. 브랜치 전용 검증은 추가할 수 있지만 이 검증을 대체할 수 없다.

현재 비공개 저장소 플랜에서는 필수 체크와 branch protection을 설정할 수 없다. 보호 기능을 활성화하기 전까지 `main` 직접 push를 금지하고, owner가 `Base Contract / verify` 성공을 확인한 PR만 수동 merge한다.
