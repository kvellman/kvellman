import { describe, expect, it } from 'vitest'
import { originMeta } from './origin'

describe('originMeta', () => {
  it('maps each provenance to a distinct label', () => {
    expect(originMeta('upstream').label).toBe('Original')
    expect(originMeta('overlay').label).toBe('Modified')
    expect(originMeta('local').label).toBe('Custom')
  })
  it('falls back to Custom for unknown values', () => {
    expect(originMeta('something-else').label).toBe('Custom')
  })
})
