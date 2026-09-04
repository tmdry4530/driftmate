import { useAccount, useChainId, useConnect, useDisconnect } from 'wagmi'
import type { AppConfig } from '../config.js'
import { evaluateGuard, guardMessage } from '../chainGuard.js'
import { shortAddress } from '../format.js'

/** Wallet connection state and chain guard (R1.1, R1.3, R1.5). */
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
        <strong>Character agent</strong>
        <span className="tag" style={{ marginLeft: 8 }}>
          {config.chainName} · {config.chainId}
        </span>
      </div>

      {guard.canExecute ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="tag">{shortAddress(guard.address)}</span>
          <button className="ghost" onClick={() => disconnect()}>
            Disconnect
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{guardMessage(guard)}</span>
          {guard.reason === 'disconnected' &&
            connectors.map((c) => (
              <button key={c.uid} className="primary" disabled={isPending} onClick={() => connect({ connector: c })}>
                Connect {c.name}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
