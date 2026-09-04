/**
 * Vite environment-variable types.
 *
 * Declared directly because root-level typechecking cannot resolve vite/client
 * from the workspace root.
 */
interface ImportMetaEnv {
  readonly [key: string]: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
