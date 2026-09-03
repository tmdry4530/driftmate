export const ENGINE_PACKAGE = '@soon/engine' as const

export { BPS_DENOMINATOR, PRICE_SCALE } from './constants.js'
export { bps, int, score } from './brand.js'
export { normalizeAddress, sameAddress } from './address.js'
export { canonical } from './canonical.js'
export { sha256Hex } from './sha256.js'
export { CHARACTERS, characterOf } from './characters.js'
export { decide } from './decide.js'
export { computeTrust, TRUST_FORMULA_VERSION } from './trust.js'
export { computePnl, type PnlInput, type PnlResult, type PortfolioSnapshot } from './pnl.js'
export { resolveGate } from './gate.js'
