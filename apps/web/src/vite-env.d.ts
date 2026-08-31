/**
 * Vite의 환경변수 타입.
 *
 * vite/client를 참조하지 않고 직접 선언한다 — 루트에서 전체를 한 번에
 * 타입체크할 때 vite가 워크스페이스 루트에 없어 해석되지 않기 때문이다.
 */
interface ImportMetaEnv {
  readonly [key: string]: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
