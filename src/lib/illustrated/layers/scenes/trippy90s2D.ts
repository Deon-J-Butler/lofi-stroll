import { createStopMotionClock } from '../../stopMotion'
import { roughFill, jitterLine, seededRandom } from '../../sketch'
import type { FrameState } from '../../types'

export interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

export function createTrippy90s2D(): SceneLayer {
  const sunClock = createStopMotionClock(10)
  const cloudClock = createStopMotionClock(5)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const sunFrame = sunClock.tick(t)
      const cloudFrame = cloudClock.tick(t)
      const vpY = H * 0.42

      // Sky gradient (orange at horizon → deep purple at top)
      const grad = ctx.createLinearGradient(0, 0, 0, vpY)
      grad.addColorStop(0, '#2a0a4a')
      grad.addColorStop(0.5, '#6a1a6a')
      grad.addColorStop(1, '#e06020')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, vpY)

      // Sun — large flat circle
      const sunX = W * 0.5
      const sunY = vpY * 0.62
      const sunR = Math.min(W, H) * 0.13
      ctx.beginPath()
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
      ctx.fillStyle = '#f5c040'
      ctx.fill()
      ctx.strokeStyle = '#e08020'
      ctx.lineWidth = 3
      ctx.stroke()

      // Radial lines: 16 spokes, rotate in discrete snapped steps
      const spokeAngle = (sunFrame % 32) * (Math.PI / 32)
      ctx.strokeStyle = 'rgba(245, 192, 64, 0.5)'
      ctx.lineWidth = 2
      for (let i = 0; i < 16; i++) {
        const angle = spokeAngle + (i / 16) * Math.PI * 2
        const seed = sunFrame * 0.3 + i
        const len = sunR * (1.4 + seededRandom(seed) * 0.4)
        jitterLine(ctx,
          sunX + Math.cos(angle) * sunR * 1.05,
          sunY + Math.sin(angle) * sunR * 1.05,
          sunX + Math.cos(angle) * len,
          sunY + Math.sin(angle) * len,
          seed, 3
        )
      }

      // Building silhouettes — two layers
      const buildingDefs = [
        // [xFraction, widthFraction, heightFraction]
        { x: 0.02, w: 0.10, h: 0.55 },
        { x: 0.11, w: 0.07, h: 0.70 },
        { x: 0.17, w: 0.09, h: 0.60 },
        { x: 0.25, w: 0.06, h: 0.80 },
        { x: 0.30, w: 0.08, h: 0.65 },
        { x: 0.62, w: 0.08, h: 0.65 },
        { x: 0.69, w: 0.06, h: 0.80 },
        { x: 0.74, w: 0.09, h: 0.60 },
        { x: 0.82, w: 0.07, h: 0.70 },
        { x: 0.88, w: 0.10, h: 0.55 },
      ]

      // Back layer (darker, shorter)
      for (const b of buildingDefs) {
        const bx = W * b.x
        const bw = W * b.w
        const bh = vpY * b.h * 0.7
        roughFill(ctx, [
          [bx, vpY], [bx + bw, vpY],
          [bx + bw, vpY - bh], [bx, vpY - bh]
        ], '#1a0830', '#0d0420', 42 + b.x * 100)
      }

      // Front layer (more saturated purple silhouettes)
      for (const b of buildingDefs) {
        const bx = W * b.x - W * 0.02
        const bw = W * b.w * 0.8
        const bh = vpY * b.h
        roughFill(ctx, [
          [bx, vpY], [bx + bw, vpY],
          [bx + bw, vpY - bh], [bx, vpY - bh]
        ], '#2d0d50', '#1a0530', 77 + b.x * 100)
      }

      // Clouds: 4 blob shapes drifting right in discrete hops
      const cloudPositions = [0.08, 0.28, 0.55, 0.78]
      for (let i = 0; i < 4; i++) {
        const hop = (cloudFrame * 0.8 + i * W * 0.25) % W
        const cx = (cloudPositions[i] * W + hop) % W
        const cy = vpY * (0.22 + i * 0.12)
        const cr = W * (0.04 + i * 0.01)
        ctx.globalAlpha = 0.55
        ctx.fillStyle = '#7a3a8a'
        ctx.beginPath()
        ctx.ellipse(cx, cy, cr * 1.6, cr * 0.7, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(cx - cr * 0.5, cy + cr * 0.2, cr, cr * 0.6, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(cx + cr * 0.5, cy + cr * 0.2, cr * 1.1, cr * 0.65, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }
  }
}
