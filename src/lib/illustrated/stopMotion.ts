export interface StopMotionClock {
  tick(realTime: number): number
  reset(): void
}

export function createStopMotionClock(fps: number): StopMotionClock {
  const interval = 1 / fps
  let lastTick = -1
  let frame = 0
  return {
    tick(t: number): number {
      if (lastTick < 0) {
        lastTick = t
        return frame
      }
      while (t >= lastTick + interval) {
        frame++
        lastTick += interval
      }
      return frame
    },
    reset() {
      lastTick = -1
      frame = 0
    }
  }
}
