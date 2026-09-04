/**
 * Wallet connection guard (R1.1, R1.3, R1.5).
 *
 * Kept pure so it can be verified without a browser. All execution-lock rules
 * live here, preventing screens from applying different conditions.
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
  if (state.reason === 'disconnected') return 'Connect a wallet to get started.'
  return `Switch to the ${state.expectedChainName} network. You are connected to chain ${state.connectedChainId}.`
}
