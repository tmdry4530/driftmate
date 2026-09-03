import { CubismFramework, Option } from '@framework/live2dcubismframework'
import { CubismShaderManager_WebGL } from '@framework/rendering/cubismshader_webgl'
import { LAppPal } from '../.live2d-sdk/Samples/TypeScript/Demo/src/lapppal'
import { LAppSubdelegate } from '../.live2d-sdk/Samples/TypeScript/Demo/src/lappsubdelegate'
import { LoadStep } from '../.live2d-sdk/Samples/TypeScript/Demo/src/lappmodel'
import * as LAppDefine from '../.live2d-sdk/Samples/TypeScript/Demo/src/lappdefine'

type CharacterId = 'timid' | 'easygoing'
type Expression = 'idle' | 'thinking' | 'asking' | 'pleased' | 'cheerful' | 'concerned' | 'apologetic' | 'quiet'

const MODELS = { timid: 'Haru', easygoing: 'Ren' } as const
const EXPRESSIONS: Record<CharacterId, Record<Expression, string>> = {
  timid: {
    idle: 'F01', thinking: 'F06', asking: 'F02', pleased: 'F05', cheerful: 'F05',
    concerned: 'F08', apologetic: 'F07', quiet: 'F04',
  },
  easygoing: {
    idle: 'exp_01', thinking: 'exp_05', asking: 'exp_05', pleased: 'exp_02', cheerful: 'exp_02',
    concerned: 'exp_05', apologetic: 'exp_04', quiet: 'exp_03',
  },
}

let initialized = false

function initializeCubism(): void {
  if (initialized) return
  LAppPal.updateTime()
  const option = new Option()
  option.logFunction = LAppPal.printMessage
  option.loggingLevel = LAppDefine.CubismLoggingLevel
  if (!CubismFramework.startUp(option)) throw new Error('Live2D Framework 초기화 실패')
  CubismFramework.initialize()
  initialized = true
}

async function waitForModel(subdelegate: LAppSubdelegate, signal: AbortSignal) {
  const deadline = performance.now() + 15_000
  while (performance.now() < deadline) {
    if (signal.aborted) throw new DOMException('Live2D 로드 취소', 'AbortError')
    const model = subdelegate.getLive2DManager()._models[0]
    const shader = CubismShaderManager_WebGL.getInstance().getShader(subdelegate.getGl())
    if (model?.getModel() && model._state === LoadStep.CompleteSetup && shader._isShaderLoaded) return model
    await new Promise((resolve) => setTimeout(resolve, 16))
  }
  throw new Error('Live2D 모델 로드 시간 초과')
}

export async function mountLive2D(
  canvas: HTMLCanvasElement,
  characterId: CharacterId,
  signal: AbortSignal,
) {
  initializeCubism()
  LAppDefine.ModelDir[0] = MODELS[characterId]

  const subdelegate = new LAppSubdelegate()
  if (!subdelegate.initialize(canvas)) throw new Error('WebGL2 초기화 실패')

  let frame = 0
  let stopped = false
  const destroy = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(frame)
    signal.removeEventListener('abort', destroy)
    const manager = subdelegate.getLive2DManager()
    manager._models[0]?.release()
    manager._models.length = 0
    subdelegate.release()
  }
  const render = () => {
    if (stopped) return
    LAppPal.updateTime()
    subdelegate.update()
    frame = requestAnimationFrame(render)
  }
  signal.addEventListener('abort', destroy, { once: true })
  frame = requestAnimationFrame(render)

  try {
    const model = await waitForModel(subdelegate, signal)
    return {
      setExpression(expression: Expression) {
        model.setExpression(EXPRESSIONS[characterId][expression])
      },
      destroy,
    }
  } catch (error) {
    destroy()
    throw error
  }
}
