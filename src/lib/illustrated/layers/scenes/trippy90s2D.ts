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

interface GradientStop {
  stop: number
  color: string
}

const SKY_STOPS: GradientStop[] = [
  { stop: 0, color: '#2a0854' },
  { stop: 0.55, color: '#7a1a7a' },
  { stop: 1, color: '#e85020' }
]

const TRIPPY_CORRIDOR_STYLE: CorridorStyle = {
  buildingColor: '#1a0840',
  inkColor: '#0d0420',
  windowLit: '#f0a820',
  windowDark: '#100828',
  buildingTypes: [
    { widthMult: 1, heightMult: 1.2, windowCols: 3, windowRows: 4 },
    { widthMult: 0.7, heightMult: 1.5, windowCols: 2, windowRows: 5 },
    { widthMult: 1.3, heightMult: 0.9, windowCols: 4, windowRows: 3 }
  ]
}

function lerpHex(a: string, b: string, t: number): string {
  const ah = Number.parseInt(a.slice(1), 16)
  const bh = Number.parseInt(b.slice(1), 16)
  const ar = (ah >> 16) & 0xff
  const ag = (ah >> 8) & 0xff
  const ab = ah & 0xff
  const br = (bh >> 16) & 0xff
  const bg = (bh >> 8) & 0xff
  const bb = bh & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const blue = Math.round(ab + (bb - ab) * t)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`
}

function lerpSkyColor(
  y: number,
  topY: number,
  bottomY: number,
  stops: GradientStop[]
): string {
  const t = Math.max(0, Math.min(1, (y - topY) / (bottomY - topY)))

  for (let index = 0; index < stops.length - 1; index++) {
    const current = stops[index]
    const next = stops[index + 1]
    if (t >= current.stop && t <= next.stop) {
      const localT = (t - current.stop) / (next.stop - current.stop)
      return lerpHex(current.color, next.color, localT)
    }
  }

  return stops[stops.length - 1].color
}

function drawStripedSun(
  ctx: CanvasRenderingContext2D,
  sunX: number,
  sunY: number,
  sunR: number
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
  ctx.clip()

  ctx.fillStyle = '#f5c040'
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2)

  const stripeCount = 8
  for (let index = 0; index < stripeCount; index++) {
    const stripeY = sunY + (index / stripeCount) * sunR
    const stripeH = (sunR / stripeCount) * 0.38
    ctx.fillStyle = lerpSkyColor(
      stripeY,
      sunY - sunR,
      sunY + sunR,
      SKY_STOPS
    )
    ctx.fillRect(sunX - sunR - 2, stripeY, sunR * 2 + 4, stripeH)
  }
  ctx.restore()

  ctx.beginPath()
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
  ctx.strokeStyle = '#c85010'
  ctx.lineWidth = Math.max(2, sunR * 0.04)
  ctx.stroke()
}

function drawClouds(
  ctx: CanvasRenderingContext2D,
  W: number,
  vpY: number,
  cloudFrame: number
): void {
  const cloudPositions = [0.03, 0.28, 0.57, 0.82]

  ctx.save()
  ctx.globalAlpha = 0.28
  ctx.fillStyle = '#8d4b99'
  ctx.filter = `blur(${Math.max(2, W * 0.003)}px)`

  for (let index = 0; index < cloudPositions.length; index++) {
    const radius = W * (0.02 + index * 0.003)
    const travel = cloudFrame * W * (0.0025 + index * 0.0004)
    const cloudX = (
      cloudPositions[index] * W + travel + radius * 2
    ) % (W + radius * 4) - radius * 2
    const cloudY = vpY * (0.2 + index * 0.13)

    ctx.beginPath()
    ctx.ellipse(cloudX, cloudY, radius * 1.65, radius * 0.62, 0, 0, Math.PI * 2)
    ctx.ellipse(cloudX - radius * 0.72, cloudY + radius * 0.13, radius, radius * 0.52, 0, 0, Math.PI * 2)
    ctx.ellipse(cloudX + radius * 0.74, cloudY + radius * 0.14, radius * 1.12, radius * 0.56, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

export function createTrippy90s2D(): SceneLayer {
  const cloudClock = createStopMotionClock(5)
  const corridor = createBuildingCorridor(TRIPPY_CORRIDOR_STYLE)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const vpY = H * 0.4
      const cloudFrame = cloudClock.tick(t)
      const sky = ctx.createLinearGradient(0, 0, 0, vpY)

      for (const stop of SKY_STOPS) sky.addColorStop(stop.stop, stop.color)
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, vpY)

      drawStripedSun(
        ctx,
        W * 0.5,
        vpY * 0.68,
        Math.min(W, H) * 0.18
      )
      drawClouds(ctx, W, vpY, cloudFrame)
    },
    drawForeground(ctx: CanvasRenderingContext2D, state: FrameState) {
      corridor.draw(ctx, state)
    },
    drawOverlay(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const vpY = H * 0.4
      const cloudFrame = cloudClock.tick(t)
      drawClouds(ctx, W, vpY, cloudFrame)
    }
  }
}
