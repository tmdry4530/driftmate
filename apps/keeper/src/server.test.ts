import { once } from 'node:events'
import { describe, expect, it } from 'vitest'
import type { Keeper } from './keeper.js'
import { startApi } from './server.js'

describe('startApi', () => {
  it('GET /status만 노출한다', async () => {
    const status = {
      phase: 'awaiting_approval',
      delegationId: '1',
      configHash: `0x${'11'.repeat(32)}`,
      pending: { trade: { amountIn: 42n, minAmountOut: 40n } },
    }
    const keeper = { refreshStatus: async () => status } as unknown as Keeper
    const server = startApi(keeper, 0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('server address missing')
    const base = `http://127.0.0.1:${address.port}`

    try {
      const response = await fetch(`${base}/status`)
      expect(await response.json()).toEqual({
        ...status,
        pending: { trade: { amountIn: '42', minAmountOut: '40' } },
      })
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect((await fetch(`${base}/approve`, { method: 'POST' })).status).toBe(404)
      expect((await fetch(`${base}/reject`, { method: 'POST' })).status).toBe(404)
    } finally {
      server.close()
      await once(server, 'close')
    }
  })
})
