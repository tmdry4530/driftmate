import { createServer, type Server } from 'node:http'
import type { DecisionId } from '@soon/shared'
import type { Keeper } from './keeper.js'

/**
 * 실행자의 최소 조회 API.
 *
 * 승인 대기 목록은 실행자 메모리에 있어서 화면이 직접 볼 수 없다. 온체인에
 * 올리는 방법도 있지만, 아직 실행되지 않은 제안을 체인에 남길 이유가 없어
 * (가스도 들고 취소도 번거롭다) 조회 경로만 연다.
 *
 * 승인·거절 자체는 여기서 받되, 실제 실행은 볼트가 한도를 다시 검증한 뒤에만
 * 일어난다 — 이 엔드포인트가 뚫려도 사용자가 서명한 한도를 넘지 못한다.
 *
 * 다만 **인증이 없다.** 지금은 127.0.0.1에만 바인딩해 같은 기기의 프로세스만 닿지만,
 * 이 상태로 로컬 밖에 노출하면 누구나 승인을 누를 수 있다 —— R5.2가 요구하는
 * "사용자가 명시적으로 승인"이 깨진다. 원격에 올리기 전에 서명 기반 인증이 필요하다.
 * (design.md 미해결 항목)
 */
export function startApi(keeper: Keeper, port: number, allowOrigin = '*', host = '127.0.0.1'): Server {
  const server = createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', allowOrigin)
    res.setHeader('access-control-allow-headers', 'content-type')
    res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }

    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json' })
      // bigint는 JSON에 그대로 못 담기므로 문자열로 내보낸다.
      res.end(JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
    }

    try {
      if (req.method === 'GET' && url.pathname === '/pending') {
        json(200, { pending: keeper.pendingApprovals() })
        return
      }

      if (req.method === 'POST' && url.pathname === '/approve') {
        const id = url.searchParams.get('id') as DecisionId | null
        if (!id) return json(400, { error: 'id가 필요해요' })
        json(200, await keeper.approve(id))
        return
      }

      if (req.method === 'POST' && url.pathname === '/reject') {
        const id = url.searchParams.get('id') as DecisionId | null
        if (!id) return json(400, { error: 'id가 필요해요' })
        await keeper.reject(id)
        json(200, { ok: true })
        return
      }

      json(404, { error: '없는 경로' })
    } catch (e) {
      json(500, { error: e instanceof Error ? e.message : '알 수 없는 오류' })
    }
  })

  // 호스트를 명시하지 않으면 IPv6에만 붙어, 같은 포트의 다른 프로세스가
  // IPv4를 쥐고 있을 때 브라우저가 엉뚱한 서버에 닿는다.
  server.listen(port, host)
  return server
}
