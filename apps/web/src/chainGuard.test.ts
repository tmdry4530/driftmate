import { describe, expect, it } from 'vitest'
import { evaluateGuard, guardMessage } from './chainGuard.js'

const ADDR = '0x1111111111111111111111111111111111111111' as const

describe('chainGuard (R1.1, R1.3, R1.5)', () => {
  it('연결 전에는 실행할 수 없다', () => {
    const s = evaluateGuard({
      address: undefined,
      connectedChainId: undefined,
      expectedChainId: 31337,
      expectedChainName: 'Anvil',
    })
    expect(s.canExecute).toBe(false)
    expect(guardMessage(s)).toContain('Connect a wallet')
  })

  it('다른 체인에 연결되면 실행을 막고 전환을 안내한다', () => {
    const s = evaluateGuard({
      address: ADDR,
      connectedChainId: 1,
      expectedChainId: 31337,
      expectedChainName: 'Anvil',
    })
    expect(s.canExecute).toBe(false)
    if (!s.canExecute && s.reason === 'wrong_chain') {
      expect(s.expectedChainName).toBe('Anvil')
    }
    expect(guardMessage(s)).toContain('Anvil')
  })

  it('올바른 체인에 연결되면 실행할 수 있다', () => {
    const s = evaluateGuard({
      address: ADDR,
      connectedChainId: 31337,
      expectedChainId: 31337,
      expectedChainName: 'Anvil',
    })
    expect(s.canExecute).toBe(true)
    if (s.canExecute) expect(s.address).toBe(ADDR)
  })

  it('연결이 끊기면 즉시 실행 불가로 돌아간다 (R1.5)', () => {
    const connected = evaluateGuard({
      address: ADDR,
      connectedChainId: 31337,
      expectedChainId: 31337,
      expectedChainName: 'Anvil',
    })
    expect(connected.canExecute).toBe(true)

    const dropped = evaluateGuard({
      address: undefined,
      connectedChainId: 31337,
      expectedChainId: 31337,
      expectedChainName: 'Anvil',
    })
    expect(dropped.canExecute).toBe(false)
  })
})
