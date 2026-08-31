/**
 * 지갑 연결 상태 판정 (R1.1, R1.3, R1.5).
 *
 * 순수 함수로 떼어내 브라우저 없이 검증한다. 실행 기능을 언제 잠글지가
 * 여기 한 곳에서만 정해지므로 화면마다 조건이 갈리지 않는다.
 */
export type GuardState =
  | { canExecute: true; address: `0x${string}`; chainId: number }
  | { canExecute: false; reason: 'disconnected' }
  | { canExecute: false; reason: 'wrong_chain'; connectedChainId: number; expectedChainId: number; expectedChainName: string }

export function evaluateGuard(input: {
  address: `0x${string}` | undefined
  connectedChainId: number | undefined
  expectedChainId: number
  expectedChainName: string
}): GuardState {
  if (!input.address || input.connectedChainId === undefined) {
    return { canExecute: false, reason: 'disconnected' }
  }
  if (input.connectedChainId !== input.expectedChainId) {
    return {
      canExecute: false,
      reason: 'wrong_chain',
      connectedChainId: input.connectedChainId,
      expectedChainId: input.expectedChainId,
      expectedChainName: input.expectedChainName,
    }
  }
  return { canExecute: true, address: input.address, chainId: input.connectedChainId }
}

export function guardMessage(state: GuardState): string {
  if (state.canExecute) return ''
  if (state.reason === 'disconnected') return '지갑을 연결하면 시작할 수 있어요.'
  return `${state.expectedChainName} 네트워크로 바꿔 주세요. 지금은 ${state.connectedChainId}번 네트워크에 연결돼 있어요.`
}
