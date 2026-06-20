import { createStopMotionClock } from '../stopMotion'
import { roughFill, jitterLine, seededRandom } from '../sketch'
import type { FrameState } from '../types'

export interface RoadLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

export function createRoadLayer(): RoadLayer {
  const clock = createStopMotionClock(8)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const frame = clock.tick(t)
      const seed = frame * 0.17

      // Vanishing point
      const vpX = W * 0.5
      const vpY = H * 0.42

      // Road edge width at bottom of canvas
      const roadHalfW = W * 0.46

      // Road shape: trapezoid from wide at bottom to a point at VP
      const roadPoints: [number, number][] = [
        [vpX - 2, vpY],
        [vpX + 2, vpY],
        [vpX + roadHalfW, H],
        [vpX - roadHalfW, H]
      ]
      roughFill(ctx, roadPoints, '#4a4840', '#1a1814', seed)

      // Ground / kerb areas (outside the road to the canvas edges)
      roughFill(ctx, [
        [0, vpY], [vpX - 2, vpY], [vpX - roadHalfW, H], [0, H]
      ], '#2d3820', '#1a2010', seed + 10)
      roughFill(ctx, [
        [vpX + 2, vpY], [W, vpY], [W, H], [vpX + roadHalfW, H]
      ], '#2d3820', '#1a2010', seed + 20)

      // Scrolling centre-line dashes
      // Perspective: dash spacing at horizon is tiny, at bottom is large
      const dashCount = 12
      const scrollOffset = (frame % (dashCount * 2)) / (dashCount * 2)

      ctx.strokeStyle = '#e8e4d0'
      ctx.lineWidth = 2
      ctx.setLineDash([])

      for (let i = 0; i < dashCount; i++) {
        // t is normalised [0,1] along road depth (0=horizon, 1=bottom)
        const tNorm = ((i + scrollOffset) / dashCount)
        if (tNorm <= 0 || tNorm > 1) continue

        // Perspective projection: positions converge toward VP
        const y = vpY + tNorm * (H - vpY)
        const perspScale = tNorm
        const dashW = 8 * perspScale
        const dashH = 18 * perspScale
        const dashSeed = seed + i * 3.7

        // Only draw every other dash (dashed line pattern)
        if (i % 2 === 0) {
          jitterLine(ctx, vpX - dashW, y - dashH, vpX - dashW, y, dashSeed, 2 * perspScale)
          jitterLine(ctx, vpX + dashW, y - dashH, vpX + dashW, y, dashSeed + 1, 2 * perspScale)
          jitterLine(ctx, vpX - dashW, y - dashH, vpX + dashW, y - dashH, dashSeed + 2, 2 * perspScale)
          jitterLine(ctx, vpX - dashW, y, vpX + dashW, y, dashSeed + 3, 2 * perspScale)
        }
      }
    }
  }
}
