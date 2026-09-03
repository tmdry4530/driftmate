import { execFileSync } from 'node:child_process'
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const webRoot = join(repoRoot, 'apps/web')
const cacheRoot = join(webRoot, '.live2d-sdk')
const publicRoot = join(webRoot, 'public/live2d')

function findZip() {
  if (process.argv[2]) return resolve(process.argv[2])
  const downloads = join(homedir(), 'Downloads')
  return readdirSync(downloads)
    .filter((name) => /^CubismSdkForWeb-.*\.zip$/.test(name))
    .map((name) => join(downloads, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
}

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8')
  if (!source.includes(before)) throw new Error(`지원하지 않는 SDK 구조: ${path}`)
  writeFileSync(path, source.replace(before, after))
}

function copy(source, target) {
  rmSync(target, { recursive: true, force: true })
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true })
}

const zip = findZip()
if (!zip || !existsSync(zip) || !/^CubismSdkForWeb-.*\.zip$/.test(basename(zip))) {
  throw new Error('CubismSdkForWeb ZIP을 찾지 못했습니다.')
}

const work = mkdtempSync(join(tmpdir(), 'soon-live2d-'))
try {
  execFileSync('unzip', ['-q', zip, '-d', work])
  const roots = readdirSync(work).filter((name) => name.startsWith('CubismSdkForWeb-'))
  if (roots.length !== 1) throw new Error('Cubism SDK ZIP 구조를 확인할 수 없습니다.')
  const sdk = join(work, roots[0])

  rmSync(cacheRoot, { recursive: true, force: true })
  copy(join(sdk, 'Framework'), join(cacheRoot, 'Framework'))
  copy(join(sdk, 'Samples/TypeScript/Demo/src'), join(cacheRoot, 'Samples/TypeScript/Demo/src'))

  const define = join(cacheRoot, 'Samples/TypeScript/Demo/src/lappdefine.ts')
  replaceOnce(define, "export const ResourcesPath = '../../Resources/';", "export const ResourcesPath = '/live2d/Resources/';")
  replaceOnce(define, "export const ShaderPath = '../../Framework/Shaders/WebGL/';", "export const ShaderPath = '/live2d/Framework/Shaders/WebGL/';")
  replaceOnce(define, 'export const DebugLogEnable = true;', 'export const DebugLogEnable = false;')

  const subdelegate = join(cacheRoot, 'Samples/TypeScript/Demo/src/lappsubdelegate.ts')
  replaceOnce(subdelegate, 'gl.clearColor(0.0, 0.0, 0.0, 1.0);', 'gl.clearColor(0.0, 0.0, 0.0, 0.0);')
  replaceOnce(subdelegate, 'this._view.initializeSprite();', 'this._view.initializeShader();')
  replaceOnce(subdelegate, 'this._view.initializeSprite();', 'this._view.initializeShader();')

  const view = join(cacheRoot, 'Samples/TypeScript/Demo/src/lappview.ts')
  replaceOnce(view, 'this._gear.release();', 'this._gear?.release();')
  replaceOnce(view, 'this._back.release();', 'this._back?.release();')
  replaceOnce(
    view,
    '  public initializeSprite(): void {',
    '  public initializeShader(): void {\n    if (this._programId == null) this._programId = this._subdelegate.createShader();\n  }\n\n  public initializeSprite(): void {',
  )

  const model = join(cacheRoot, 'Samples/TypeScript/Demo/src/lappmodel.ts')
  replaceOnce(model, 'enum LoadStep {', 'export enum LoadStep {')
  replaceOnce(model, "import { CubismIdHandle } from '@framework/id/cubismid';", "import { type CubismIdHandle } from '@framework/id/cubismid';")
  replaceOnce(model, '  BeganMotionCallback,\n  FinishedMotionCallback', '  type BeganMotionCallback,\n  type FinishedMotionCallback')
  replaceOnce(model, '  CubismMotionQueueEntryHandle,\n  InvalidMotionQueueEntryHandleValue', '  type CubismMotionQueueEntryHandle,\n  InvalidMotionQueueEntryHandleValue')

  mkdirSync(publicRoot, { recursive: true })
  copy(join(sdk, 'Core/live2dcubismcore.min.js'), join(publicRoot, 'live2dcubismcore.min.js'))
  copy(join(sdk, 'Framework/Shaders'), join(publicRoot, 'Framework/Shaders'))
  copy(join(sdk, 'Samples/Resources/Haru'), join(publicRoot, 'Resources/Haru'))
  copy(join(sdk, 'Samples/Resources/Ren'), join(publicRoot, 'Resources/Ren'))
  copy(join(sdk, 'LICENSE.md'), join(publicRoot, 'LICENSE.md'))
  copy(join(sdk, 'Core/LICENSE.md'), join(publicRoot, 'Core-LICENSE.md'))
  copy(join(sdk, 'Framework/LICENSE.md'), join(publicRoot, 'Framework-LICENSE.md'))
  rmSync(join(publicRoot, 'Resources/back_class_normal.png'), { force: true })
  rmSync(join(publicRoot, 'Resources/icon_gear.png'), { force: true })

  rmSync(join(publicRoot, 'runtime.js'), { force: true })
  rmSync(join(publicRoot, 'runtime.iife.js'), { force: true })
  execFileSync('pnpm', ['exec', 'vite', 'build', '--config', 'live2d/vite.config.ts'], {
    cwd: webRoot,
    stdio: 'inherit',
  })
  console.log(`Live2D ${basename(zip, '.zip')} 준비 완료`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
