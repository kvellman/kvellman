import { beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

// useZodForm relies on the Nuxt auto-imported `ref`/`watch` globals; stub them for a plain unit
// test (validate logic needs no real reactivity).
beforeAll(() => {
  vi.stubGlobal('ref', <T>(value: T) => ({ value }))
  vi.stubGlobal('watch', () => {})
})

const { useZodForm } = await import('./useZodForm')

const schema = z.object({
  name: z.string().min(1),
  tag: z.string().min(3).optional(),
})

describe('useZodForm.validate', () => {
  it('hides errors for empty fields before the first submit', () => {
    const zf = useZodForm(schema)
    expect(zf.validate({ name: '', tag: '' })).toEqual([])
  })

  it('shows errors for non-empty invalid fields before submit, but not empty ones', () => {
    const zf = useZodForm(schema)
    const errors = zf.validate({ name: '', tag: 'ab' })
    expect(errors.some((e) => e.name === 'tag')).toBe(true)
    expect(errors.some((e) => e.name === 'name')).toBe(false)
  })

  it('validates empty required fields after a submit attempt', async () => {
    const zf = useZodForm(schema)
    await zf.submit(undefined) // marks submitted, returns false (no form)
    const errors = zf.validate({ name: '', tag: '' })
    expect(errors.some((e) => e.name === 'name')).toBe(true)
  })
})
