import type { CharacterId } from './primitives.js'

export type Persona = Readonly<{
  characterId: CharacterId
  voice: string
  tone: string
}>

/**
 * Narrator가 돌려줄 수 있는 전부 (R8.2).
 * 이 타입을 인자로 받는 함수는 실행 경로에 존재하지 않는다 — 화면만이 소비자다.
 */
export type Narration = Readonly<{
  text: string
  /** 생성 실패·검증 실패로 템플릿 문장이 쓰였는지 (R8.3, R8.5). */
  fallback: boolean
}>
