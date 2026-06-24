/* eslint-disable @typescript-eslint/no-explicit-any */
// Generic binding helpers for the manifest field components: coerce stored null ⇄ '' for text
// inputs, comma-separated text ⇄ string[], and pass-through for enums/booleans. Writes mutate
// the (reactive) target object in place, storing null/[] for "empty" so the payload stays clean.
export function useObjectFields(target: () => Record<string, any>) {
  return {
    str: (key: string): string => (target()[key] as string) ?? '',
    setStr: (key: string, v: string) => {
      target()[key] = v === '' ? null : v
    },
    arr: (key: string): string => {
      const a = target()[key]
      return Array.isArray(a) ? a.join(', ') : ''
    },
    setArr: (key: string, v: string) => {
      const listv = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      target()[key] = listv.length ? listv : null
    },
    list: (key: string): any[] => {
      const a = target()[key]
      return Array.isArray(a) ? a : []
    },
    bool: (key: string): boolean => target()[key] === true,
    get: (key: string): unknown => target()[key] ?? null,
    set: (key: string, v: unknown) => {
      target()[key] = v === undefined || v === '' ? null : v
    },
  }
}
