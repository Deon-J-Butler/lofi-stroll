import { describe, it, expect } from 'vitest'
import { seededRandom } from './sketch'

describe('seededRandom', () => {
  it('returns a value in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const v = seededRandom(i)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is deterministic — same seed gives same value', () => {
    expect(seededRandom(42)).toBe(seededRandom(42))
    expect(seededRandom(7)).toBe(seededRandom(7))
  })

  it('different seeds give different values', () => {
    expect(seededRandom(1)).not.toBe(seededRandom(2))
  })
})
