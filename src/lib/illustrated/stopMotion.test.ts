import { describe, it, expect } from 'vitest'
import { createStopMotionClock } from './stopMotion'

describe('createStopMotionClock', () => {
  it('returns 0 before any interval elapses', () => {
    const clock = createStopMotionClock(8)
    expect(clock.tick(0)).toBe(0)
    expect(clock.tick(0.05)).toBe(0)
  })

  it('advances frame after one interval', () => {
    const clock = createStopMotionClock(8) // 125ms intervals
    clock.tick(0)
    expect(clock.tick(0.125)).toBe(1)
  })

  it('advances multiple frames for large time jump', () => {
    const clock = createStopMotionClock(8)
    clock.tick(0)
    expect(clock.tick(1.0)).toBe(8)
  })

  it('reset returns to frame 0', () => {
    const clock = createStopMotionClock(8)
    clock.tick(0)
    clock.tick(1.0)
    clock.reset()
    expect(clock.tick(0)).toBe(0)
  })
})
