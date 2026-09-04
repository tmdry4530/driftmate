---
feature: midnight-private-mandate
spec_id: INT-2026-0904
status: approved
---

# Midnight Private Character Protocol — Release Plan

- **대상 환경**: GitHub Pages `https://tmdry4530.github.io/driftmate/`, Local Devnet proof는 배포 대상에서 제외
- **변경·migration 순서**: Pages base path와 ZK asset base를 빌드 시 주입 → 검증 → Pages 활성화 → `hackathon/midnight-korea`에 branch-scoped workflow push
- **승인 참조**: `approvals.yaml` release version 2
- **Smoke check**: 공개 URL HTTP 200, `PRIVATE / PROVEN / PUBLIC` 초기 상태, `/driftmate/keys/openRelationship.prover` HTTP 200, console error 0
- **관찰 항목/기간**: Actions build/deploy 종료와 공개 URL 최초 확인까지; private input이나 wallet secret은 관찰·수집하지 않음
- **Rollback trigger**: page 또는 ZK asset 404, base path 오류, 초기 화면이 proof 성공을 허위 표시, workflow 실패
- **Rollback 또는 roll-forward**: Pages workflow를 비활성화하고 직전 artifact로 되돌리거나 base/asset path만 수정해 수동 재배포
