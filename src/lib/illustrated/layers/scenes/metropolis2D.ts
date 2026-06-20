import {
  createBuildingCorridor,
  type CorridorStyle
} from '../buildingCorridor'
import { createStopMotionClock } from '../../stopMotion'
import type { FrameState } from '../../types'

export interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
  drawForeground?(ctx: CanvasRenderingContext2D, state: FrameState): void
  drawOverlay?(ctx: CanvasRenderingContext2D, state: FrameState): void
}

const METRO_CORRIDOR_STYLE: CorridorStyle = {
  buildingColor: '#101820',
  inkColor: '#080e14',
  windowLit: '#44aaff',
  windowDark: '#0a1018',
  buildingTypes: [
    {
      widthMult: 1,
      heightMult: 1.2,
      windowCols: 4,
      windowRows: 4,
      accentColor: '#ff44aa'
    },
    {
      widthMult: 0.8,
      heightMult: 1.5,
      windowCols: 3,
      windowRows: 5,
      accentColor: '#44ffcc'
    },
    {
      widthMult: 1.2,
      heightMult: 0.9,
      windowCols: 5,
      windowRows: 3,
      accentColor: '#ffaa00'
    }
  ]
}

function drawSmog(
  ctx: CanvasRenderingContext2D,
  W: number,
  vpY: number,
  smogFrame: number
): void {
  const offset = (smogFrame % 8) * W * 0.03

  ctx.save()
  ctx.fillStyle = 'rgba(100, 130, 170, 0.12)'
  ctx.fillRect(-offset, vpY * 0.85, W * 1.35, vpY * 0.1)
  ctx.fillStyle = 'rgba(120, 145, 180, 0.08)'
  ctx.fillRect(
    -offset * 0.45 + W * 0.08,
    vpY * 0.72,
    W * 1.25,
    vpY * 0.07
  )
  ctx.restore()
}

export function createMetropolis2D(): SceneLayer {
  const smogClock = createStopMotionClock(3)
  const corridor = createBuildingCorridor(METRO_CORRIDOR_STYLE)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { canvasW: W, canvasH: H } = state
      const vpY = H * 0.4

      const sky = ctx.createLinearGradient(0, 0, 0, vpY)
      sky.addColorStop(0, '#050810')
      sky.addColorStop(1, '#0a1428')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, vpY)
    },
    drawForeground(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const vpY = H * 0.4
      const smogFrame = smogClock.tick(t)
      corridor.draw(ctx, state)

      const horizonHaze = ctx.createLinearGradient(
        0,
        vpY * 0.72,
        0,
        vpY * 1.05
      )
      horizonHaze.addColorStop(0, 'rgba(5, 8, 16, 0)')
      horizonHaze.addColorStop(0.65, 'rgba(5, 8, 16, 0.14)')
      horizonHaze.addColorStop(1, 'rgba(5, 8, 16, 0)')
      ctx.fillStyle = horizonHaze
      ctx.fillRect(0, vpY * 0.7, W, vpY * 0.38)

      drawSmog(ctx, W, vpY, smogFrame)
    },
    drawOverlay(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const vpY = H * 0.4
      const smogFrame = smogClock.tick(t)
      drawSmog(ctx, W, vpY, smogFrame)
    }
  }
}
