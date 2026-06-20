import {
  createBuildingCorridor,
  type CorridorStyle,
  type FacadeGeometry
} from '../buildingCorridor'
import { createStopMotionClock } from '../../stopMotion'
import { roughFill, seededRandom } from '../../sketch'
import type { FrameState } from '../../types'

export interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
  drawForeground?(ctx: CanvasRenderingContext2D, state: FrameState): void
  drawOverlay?(ctx: CanvasRenderingContext2D, state: FrameState): void
}

function drawTreeFacade(
  ctx: CanvasRenderingContext2D,
  facade: FacadeGeometry
): void {
  const {
    x,
    y,
    width,
    height,
    side,
    seed,
    depth,
    style
  } = facade
  const centerX = x + width * 0.5
  const trunkTop = y + height * 0.3
  const trunkW = Math.max(2, width * 0.2)
  const lean = (side === 'left' ? -1 : 1) * width * 0.04

  roughFill(ctx, [
    [centerX - trunkW * 0.5, y + height],
    [centerX + trunkW * 0.5, y + height],
    [centerX + trunkW * 0.36 + lean, trunkTop],
    [centerX - trunkW * 0.36 + lean, trunkTop]
  ], style.buildingColor, style.inkColor, seed)

  ctx.save()
  ctx.fillStyle = style.buildingColor
  ctx.strokeStyle = style.inkColor
  ctx.lineWidth = Math.max(1.5, depth * 3)
  ctx.beginPath()
  ctx.ellipse(centerX + lean, y + height * 0.2, width * 0.52, height * 0.2, 0, 0, Math.PI * 2)
  ctx.ellipse(centerX - width * 0.25 + lean, y + height * 0.31, width * 0.42, height * 0.18, -0.15, 0, Math.PI * 2)
  ctx.ellipse(centerX + width * 0.27 + lean, y + height * 0.32, width * 0.46, height * 0.19, 0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

const JUNGLE_CORRIDOR_STYLE: CorridorStyle = {
  buildingColor: '#0a1a04',
  inkColor: '#050e02',
  windowLit: '#aaff88',
  windowDark: '#0a1a04',
  buildingTypes: [
    { widthMult: 0.5, heightMult: 1.1, windowCols: 2, windowRows: 1 },
    { widthMult: 0.8, heightMult: 0.9, windowCols: 3, windowRows: 1 },
    { widthMult: 0.6, heightMult: 1.3, windowCols: 2, windowRows: 2 }
  ],
  drawFacade: drawTreeFacade
}

function drawFireflies(
  ctx: CanvasRenderingContext2D,
  W: number,
  vpY: number,
  fireflyFrame: number
): void {
  for (let index = 0; index < 12; index++) {
    const seed = index * 13.1
    const sideBand = index % 2 === 0
      ? 0.02 + seededRandom(seed) * 0.3
      : 0.68 + seededRandom(seed) * 0.3
    const x = W * sideBand
    const y = vpY * (0.12 + seededRandom(seed + 1) * 0.82)
    const isOn = seededRandom(seed + fireflyFrame * 0.7) > 0.4
    if (!isOn) continue

    const radius = 2 + seededRandom(seed + 2)
    ctx.save()
    ctx.globalAlpha = 0.15
    ctx.fillStyle = '#aaff88'
    ctx.beginPath()
    ctx.arc(x, y, radius * 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawDappledLight(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  vpY: number,
  lightFrame: number
): void {
  ctx.save()
  ctx.fillStyle = 'rgba(255, 200, 80, 0.12)'

  for (let index = 0; index < 8; index++) {
    const seed = index * 5.7 + lightFrame * 11
    const depth = 0.12 + seededRandom(seed + 1) * 0.78
    const roadHalfW = W * 0.36 * depth
    const x = W * 0.5 + (seededRandom(seed) - 0.5) * roadHalfW * 1.5
    const y = vpY + depth * (H - vpY)
    const radius = W * (0.012 + seededRandom(seed + 2) * 0.025) * depth

    ctx.beginPath()
    ctx.ellipse(x, y, radius * 1.8, radius * 0.65, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

export function createJungle2D(): SceneLayer {
  const fireflyClock = createStopMotionClock(4)
  const lightClock = createStopMotionClock(6)
  const corridor = createBuildingCorridor(JUNGLE_CORRIDOR_STYLE)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { canvasW: W, canvasH: H } = state
      const vpY = H * 0.4

      const sky = ctx.createLinearGradient(0, 0, 0, vpY)
      sky.addColorStop(0, '#3a1400')
      sky.addColorStop(0.55, '#7a3000')
      sky.addColorStop(1, '#e06020')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, vpY)

      const haze = ctx.createRadialGradient(
        W * 0.5,
        vpY,
        0,
        W * 0.5,
        vpY,
        W * 0.32
      )
      haze.addColorStop(0, 'rgba(255, 190, 90, 0.2)')
      haze.addColorStop(1, 'rgba(255, 190, 90, 0)')
      ctx.fillStyle = haze
      ctx.fillRect(0, vpY * 0.45, W, vpY * 0.55)
    },
    drawForeground(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const vpY = H * 0.4
      const fireflyFrame = fireflyClock.tick(t)
      const lightFrame = lightClock.tick(t)
      corridor.draw(ctx, state)
      drawFireflies(ctx, W, vpY, fireflyFrame)
      drawDappledLight(ctx, W, H, vpY, lightFrame)
    },
    drawOverlay(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const vpY = H * 0.4
      const fireflyFrame = fireflyClock.tick(t)
      const lightFrame = lightClock.tick(t)
      drawFireflies(ctx, W, vpY, fireflyFrame)
      if (state.lighting !== 'night') {
        drawDappledLight(ctx, W, H, vpY, lightFrame)
      }
    }
  }
}
