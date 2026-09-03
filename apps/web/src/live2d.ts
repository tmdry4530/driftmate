import type { CharacterId } from '@soon/shared'
import type { Live2DController, Live2DLoader } from './components/CharacterStage.js'

type Live2DRuntime = Readonly<{
  mountLive2D(canvas: HTMLCanvasElement, characterId: CharacterId, signal: AbortSignal): Promise<Live2DController>
}>

let runtimePromise: Promise<Live2DRuntime> | undefined

function loadScript(src: string, marker: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[${marker}]`)
    const script = existing ?? document.createElement('script')
    const onLoad = () => {
      if (ready()) resolve()
      else {
        script.remove()
        reject(new Error(`${src} 초기화 실패`))
      }
    }
    const onError = () => {
      script.remove()
      reject(new Error(`${src} 로드 실패`))
    }
    if (existing) {
      existing.addEventListener('load', onLoad, { once: true })
      existing.addEventListener('error', onError, { once: true })
      return
    }

    script.src = src
    script.setAttribute(marker, '')
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    document.head.append(script)
  })
}

async function runtime(): Promise<Live2DRuntime> {
  if (!runtimePromise) {
    const live2dWindow = window as typeof window & {
      Live2DCubismCore?: unknown
      SoonLive2D?: Live2DRuntime
    }
    runtimePromise = loadScript(
      '/live2d/live2dcubismcore.min.js',
      'data-live2d-core',
      () => live2dWindow.Live2DCubismCore !== undefined,
    )
      .then(() => loadScript(
        '/live2d/runtime.js',
        'data-live2d-runtime',
        () => live2dWindow.SoonLive2D !== undefined,
      ))
      .then(() => live2dWindow.SoonLive2D!)
      .catch((error: unknown) => {
        runtimePromise = undefined
        throw error
      })
  }
  return runtimePromise
}

export const live2dLoader: Live2DLoader = {
  async load(canvas, characterId, signal) {
    const loaded = await runtime()
    if (signal.aborted) throw new DOMException('Live2D 로드 취소', 'AbortError')
    return loaded.mountLive2D(canvas, characterId, signal)
  },
}
