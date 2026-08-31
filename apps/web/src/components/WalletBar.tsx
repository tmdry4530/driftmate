import { useAccount, useChainId, useConnect, useDisconnect } from 'wagmi'
import type { AppConfig } from '../config.js'
import { evaluateGuard, guardMessage } from '../chainGuard.js'
import { shortAddress } from '../format.js'

/** 지갑 연결 상태와 체인 가드 (R1.1, R1.3, R1.5). */
export function WalletBar({ config }: { config: AppConfig }) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const guard = evaluateGuard({
    address: isConnected ? address : undefined,
    connectedChainId: isConnected ? chainId : undefined,
    expectedChainId: config.chainId,
    expectedChainName: config.chainName,
  })

  return (
    <div className="bar">
      <div>
        <strong>캐릭터 에이전트</strong>
        <span className="tag" style={{ marginLeft: 8 }}>
          {config.chainName} · {config.chainId}
        </span>
      </div>

      {guard.canExecute ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="tag">{shortAddress(guard.address)}</span>
          <button className="ghost" onClick={() => disconnect()}>
            연결 끊기
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{guardMessage(guard)}</span>
          {guard.reason === 'disconnected' &&
            connectors.map((c) => (
              <button key={c.uid} className="primary" disabled={isPending} onClick={() => connect({ connector: c })}>
                {c.name} 연결
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
