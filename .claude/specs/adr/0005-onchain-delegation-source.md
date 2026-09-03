# ADR-0005: 사용자 서명 위임을 운용 설정의 단일 원천으로 쓴다

- **날짜**: 2026-09-03
- **상태**: 승인됨
- **관련 기능**: character-agent-rebalancer
- **관련 요구사항**: R2.3, R3.1~R3.7, R5.4, R6.4

## 맥락

기존 구현은 웹에서 캐릭터와 목표 비중을 입력받지만 `setDelegation`에 포함하지 않고, Keeper가 별도 고정 설정의 캐릭터·목표·DEX·슬리피지·승인 유효 시간을 사용한다. 화면에서 확인한 내용과 실제 자동 실행 입력이 달라질 수 있어 서명의 의미와 결정 재현성이 깨진다.

## 검토한 대안

### 1. 웹과 Keeper의 환경 설정을 계속 따로 관리

변경량은 가장 적지만 두 설정이 같다는 것을 증명할 수 없다. 현재 결함을 그대로 둔다.

### 2. 별도의 오프체인 서명 문서를 저장

컨트랙트 변경은 줄지만 서명 문서 저장소, 검증 API와 가용성 문제가 새로 생긴다. 온체인 이벤트만을 진실 원천으로 쓰는 현재 구조보다 복잡하다.

### 3. AgentVault의 Delegation에 운용 입력을 함께 저장

사용자가 한 번 서명한 구조체를 웹, Keeper와 컨트랙트가 같이 읽는다. ABI 변경과 재배포가 필요하지만 현재는 로컬 MVP라 마이그레이션 비용이 작다.

## 결정

**3번을 채택한다.** `Delegation`에 `characterId`, `strategyHash`, `trustFormulaVersion`, `targetAsset`, `targetAssetBps`, `operatingCap`, `approvalTtlSeconds`, `slippageToleranceBps`를 추가한다. MVP는 자산 2개와 DEX 1개만 허용하고 `allowedDexes[0]`을 가격 조회와 실행 DEX로 사용한다.

Keeper 환경에는 RPC, 볼트 주소, 폴링 주기 같은 인프라 값만 남긴다. 매 tick에서 현재 위임 원문을 읽고 캐릭터 전략, 목표 비중, 자산, DEX와 사용자 한도를 구성한다.

AgentVault는 두 자산의 중복, target·quote 포함 여부, DEX 페어와 각 상한 관계를 저장 전에 검증한다. 컨트랙트는 캐릭터 목록을 하드코딩하지 않고 characterId와 strategyHash가 비어 있지 않은지만 검사하며, 지원 여부와 전략 해시 일치는 Keeper가 판단한다.

실행·미실행·비용 호출은 `expectedDelegationId`를 받고 현재 값과 다르면 거부한다. 새 판단 호출은 `expectedStateNonce`도 검사해 같은 위임 안의 오래된 요청을 거부하고, pending 중에는 새 판단을 받지 않는다. characterId와 신뢰 공식 버전은 실행자가 넘기지 않고 AgentVault가 현재 위임에서 읽어 이벤트에 기록한다.

executor의 자동 실행 함수는 거래 가치가 사용자가 서명한 `autoThreshold` 이하일 때만 통과한다. 신뢰 점수로 더 낮아진 유효 임계값과 그 초과분의 승인 요청은 Keeper가 지키는 제품 정확성 규칙이다. 탈취된 executor가 그 낮은 값을 우회할 가능성은 남지만 서명된 절대 자동 실행 상한은 넘지 못한다.

승인 요청은 서버 메모리가 아니라 AgentVault의 단일 pending 상태에 delegationId, proposalNonce, decisionId, 주문 해시, evidence 해시와 만료 시각을 저장한다. 주문 원문은 같은 트랜잭션 이벤트에 남긴다. 승인은 owner가 지갑으로 직접 호출하고 컨트랙트가 nonce·해시·만료를 다시 검사한다. 승인·거절 권한이 있는 Keeper API는 만들지 않는다.

## 결과

- 웹에서 본 값과 Keeper가 실행한 값의 해시를 비교할 수 있다.
- 캐릭터와 목표 비중이 위임 수명 동안 바뀌지 않는다.
- Keeper가 재시작돼도 승인 대상을 체인에서 복원할 수 있다.
- 중복 Keeper가 같은 위임의 오래된 판단을 실행하거나 pending 중 잔고를 바꿀 수 없다.
- executor 키가 탈취돼도 자동 실행은 사용자가 서명한 autoThreshold를 넘지 못한다.
- 새 캐릭터나 목표를 쓰려면 기존 위임을 철회하고 다시 서명해야 한다.
- 구조체와 이벤트 ABI가 깨지므로 기존 로컬 AgentVault를 재배포한다.
- 다중 DEX 라우팅과 임의 자산 수는 이번 범위에서 만들지 않는다. 필요해질 때 별도 라우터 설계를 추가한다.
