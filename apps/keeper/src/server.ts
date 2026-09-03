import { createServer, type Server } from 'node:http'
import type { Keeper } from './keeper.js'

export function startApi(keeper: Keeper, port: number, allowOrigin = '*', host = '127.0.0.1'): Server {
  const server = createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', allowOrigin)
    res.setHeader('access-control-allow-methods', 'GET,OPTIONS')
    res.setHeader('cache-control', 'no-store')

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }

    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    if (req.method === 'GET' && url.pathname === '/status') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(await keeper.refreshStatus(), (_key, value) =>
        typeof value === 'bigint' ? String(value) : value))
      return
    }

    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: '없는 경로' }))
  })
  server.listen(port, host)
  return server
}
