/**
 * 결정론적 직렬화.
 *
 * 객체 키를 정렬해서 같은 내용이면 항상 같은 문자열이 나오게 한다.
 * JSON.stringify는 bigint를 던지고 키 순서를 보장하지 않으므로 직접 만든다.
 */
export function canonical(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  switch (typeof value) {
    case 'bigint':
      return `${value}n`
    case 'string':
      return JSON.stringify(value)
    case 'boolean':
      return String(value)
    case 'number':
      if (!Number.isFinite(value)) {
        throw new RangeError(`non-finite number is not serializable: ${value}`)
      }
      // 판단 입력에 소수가 들어오면 반올림 차이가 결정론을 깨므로 여기서 막는다.
      if (!Number.isInteger(value)) {
        throw new RangeError(`non-integer number is not serializable: ${value}`)
      }
      return String(value)
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map(canonical).join(',')}]`
      }
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
    }
    default:
      throw new TypeError(`unsupported value type: ${typeof value}`)
  }
}
