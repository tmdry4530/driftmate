import { useEffect, useRef, useState } from 'react'
import type { CharacterId, Narration } from '@soon/shared'
import { type AgentState, buildLossReport, expressionFor } from '../characterState.js'

/**
 * 캐릭터 무대 (R9.1, R9.2, R9.4, R9.5).
 *
 * Live2D 모델을 불러오되, 없거나 실패하면 정적 표현으로 대체하고 나머지 기능은
 * 그대로 돌아간다. SDK는 라이선스 동의가 필요해 저장소에 넣지 않으므로,
 * SDK 생성물은 라이선스 때문에 Git에서 제외하고 setup 명령으로 복원한다.
 */
export interface Live2DLoader {
  load(canvas: HTMLCanvasElement, characterId: CharacterId, signal: AbortSignal): Promise<Live2DController>
}

export interface Live2DController {
  setExpression(expression: string): void
  destroy(): void
}

const FACE: Record<string, { eyes: string; mouth: string; tint: string }> = {
  idle: { eyes: 'normal', mouth: 'M 44 62 Q 52 68 60 62', tint: 'var(--accent)' },
  thinking: { eyes: 'normal', mouth: 'M 44 64 L 60 64', tint: 'var(--blue)' },
  asking: { eyes: 'wide', mouth: 'M 44 62 Q 52 70 60 62', tint: 'var(--blue)' },
  pleased: { eyes: 'happy', mouth: 'M 42 60 Q 52 70 62 60', tint: 'var(--accent)' },
  cheerful: { eyes: 'happy', mouth: 'M 42 60 Q 52 72 62 60', tint: 'var(--accent)' },
  concerned: { eyes: 'down', mouth: 'M 44 66 Q 52 61 60 66', tint: 'var(--ink-soft)' },
  apologetic: { eyes: 'down', mouth: 'M 45 66 Q 52 63 59 66', tint: 'var(--ink-soft)' },
  quiet: { eyes: 'closed', mouth: 'M 45 65 L 59 65', tint: 'var(--ink-soft)' },
}

function Face({ expression }: { expression: string }) {
  const f = FACE[expression] ?? FACE.idle!
  return (
    <svg viewBox="0 0 104 104" width="132" height="132" role="img" aria-label={`캐릭터 표정: ${expression}`}>
      <circle cx="52" cy="52" r="40" fill={f.tint} opacity="0.16" />
      <circle cx="52" cy="52" r="34" fill="none" stroke={f.tint} strokeWidth="2.5" />
      {f.eyes === 'closed' ? (
        <>
          <path d="M 36 46 Q 41 50 46 46" stroke={f.tint} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 58 46 Q 63 50 68 46" stroke={f.tint} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : f.eyes === 'happy' ? (
        <>
          <path d="M 36 48 Q 41 42 46 48" stroke={f.tint} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 58 48 Q 63 42 68 48" stroke={f.tint} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="41" cy="47" r={f.eyes === 'wide' ? 5 : 4} fill={f.tint} />
          <circle cx="63" cy="47" r={f.eyes === 'wide' ? 5 : 4} fill={f.tint} />
          {f.eyes === 'down' && (
            <>
              <path d="M 35 41 L 47 44" stroke={f.tint} strokeWidth="2" strokeLinecap="round" />
              <path d="M 69 41 L 57 44" stroke={f.tint} strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </>
      )}
      <path d={f.mouth} stroke={f.tint} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function CharacterStage({
  state,
  characterId,
  characterName,
  narration,
  loader,
}: {
  state: AgentState
  characterId: CharacterId
  characterName: string
  narration: Narration | undefined
  loader?: Live2DLoader | undefined
}) {
  const [live2dReady, setLive2dReady] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<Live2DController>(undefined)
  const expression = expressionFor(state)
  const expressionRef = useRef(expression)
  expressionRef.current = expression

  useEffect(() => {
    controllerRef.current?.setExpression(expression)
  }, [expression])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!loader || !canvas) {
      setLive2dReady(false)
      return
    }
    let cancelled = false
    const abortController = new AbortController()
    controllerRef.current = undefined
    setLive2dReady(false)
    loader
      .load(canvas, characterId, abortController.signal)
      .then((controller) => {
        if (cancelled) {
          controller.destroy()
          return
        }
        controllerRef.current = controller
        controller.setExpression(expressionRef.current)
        setLive2dReady(true)
      })
      .catch(() => {
        // 모델을 못 불러와도 나머지는 그대로 쓴다 (R9.5).
        if (!cancelled) {
          controllerRef.current?.destroy()
          controllerRef.current = undefined
          setLive2dReady(false)
        }
      })
    return () => {
      cancelled = true
      abortController.abort()
      controllerRef.current?.destroy()
      controllerRef.current = undefined
    }
  }, [loader, characterId])

  const loss = state.kind === 'loss' ? buildLossReport(state.pnlBps, characterName) : undefined

  return (
    <div className="stage">
      <div className="character-avatar">
        <canvas
          ref={canvasRef}
          id="live2d-canvas"
          width={240}
          height={240}
          role="img"
          aria-label={`Live2D 캐릭터: ${characterName}`}
          aria-hidden={!live2dReady}
          style={{ visibility: live2dReady ? 'visible' : 'hidden' }}
        />
        {!live2dReady && <Face expression={expression} />}
      </div>
      <div style={{ fontWeight: 600 }}>{characterName}</div>

      {/* 손실은 수치를 먼저, 캐릭터 반응을 나중에 (R9.4). */}
      {loss && (
        <div style={{ textAlign: 'center' }}>
          <div className="loss-head">{loss.headline}</div>
          <div className="loss-react">{loss.reaction}</div>
        </div>
      )}

      {narration && (
        <div className="speech">
          {narration.text}
          {narration.fallback && <span className="fallback">설명을 만들지 못해 기본 문장으로 보여드려요.</span>}
        </div>
      )}
    </div>
  )
}
