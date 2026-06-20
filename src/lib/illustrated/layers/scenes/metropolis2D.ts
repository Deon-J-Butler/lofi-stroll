import { createStopMotionClock } from '../../stopMotion'
import { roughFill, seededRandom } from '../../sketch'
import type { FrameState } from '../../types'

export interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

export function createMetropolis2D(): SceneLayer {
  const smogClock = createStopMotionClock(4)
  const billboardClock = createStopMotionClock(12)
  const neonClock = createStopMotionClock(12)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const smogFrame = smogClock.tick(t)
      const billboardFrame = billboardClock.tick(t)
      const neonFrame = neonClock.tick(t)
      const vpY = H * 0.42

      // Sky: dark blue-grey city haze
      const grad = ctx.createLinearGradient(0, 0, 0, vpY)
      grad.addColorStop(0, '#0a1428')
      grad.addColorStop(0.6, '#1a2a4a')
      grad.addColorStop(1, '#2a3a5a')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, vpY)

      // Building silhouettes
      const buildingDefs = [
        { x: 0.00, w: 0.09, h: 0.60 },
        { x: 0.08, w: 0.06, h: 0.85 },
        { x: 0.13, w: 0.10, h: 0.72 },
        { x: 0.22, w: 0.05, h: 0.95 },
        { x: 0.26, w: 0.08, h: 0.78 },
        { x: 0.34, w: 0.05, h: 0.62 },
        { x: 0.62, w: 0.05, h: 0.62 },
        { x: 0.66, w: 0.08, h: 0.78 },
        { x: 0.73, w: 0.05, h: 0.95 },
        { x: 0.77, w: 0.10, h: 0.72 },
        { x: 0.86, w: 0.06, h: 0.85 },
        { x: 0.91, w: 0.09, h: 0.60 },
      ]

      // Back layer
      for (const b of buildingDefs) {
        const bx = W * b.x
        const bw = W * b.w
        const bh = vpY * b.h * 0.85
        roughFill(ctx, [
          [bx, vpY], [bx + bw, vpY],
          [bx + bw, vpY - bh], [bx, vpY - bh]
        ], '#0e1c36', '#06101e', 31 + b.x * 100)
      }

      // Front layer
      for (const b of buildingDefs) {
        const bx = W * b.x + W * 0.015
        const bw = W * b.w * 0.75
        const bh = vpY * b.h
        roughFill(ctx, [
          [bx, vpY], [bx + bw, vpY],
          [bx + bw, vpY - bh], [bx, vpY - bh]
        ], '#182840', '#0a1828', 67 + b.x * 100)
      }

      // Billboard rectangles: flicker between two colour states
      const billboardDefs = [
        { x: 0.10, y: 0.38, w: 0.07, h: 0.12, hue1: 0.05, hue2: 0.58 },
        { x: 0.24, y: 0.20, w: 0.06, h: 0.10, hue1: 0.92, hue2: 0.14 },
        { x: 0.68, y: 0.25, w: 0.06, h: 0.10, hue1: 0.56, hue2: 0.05 },
        { x: 0.78, y: 0.35, w: 0.07, h: 0.12, hue1: 0.14, hue2: 0.92 },
      ]

      for (let i = 0; i < billboardDefs.length; i++) {
        const b = billboardDefs[i]
        const active = Math.floor(seededRandom(i * 3.7 + billboardFrame * 0.4) * 3) !== 0
        const hue = active ? b.hue1 : b.hue2
        const bx = W * b.x
        const by = vpY * b.y
        const bw = W * b.w
        const bh = vpY * b.h
        roughFill(ctx, [
          [bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]
        ], `hsl(${Math.round(hue * 360)}, 80%, 40%)`, '#000', i * 5.1)
      }

      // Neon glow blocks cycling hue
      const neonDefs = [
        { x: 0.08, y: 0.72, w: 0.035, h: 0.055 },
        { x: 0.25, y: 0.50, w: 0.030, h: 0.045 },
        { x: 0.67, y: 0.52, w: 0.030, h: 0.045 },
        { x: 0.83, y: 0.68, w: 0.035, h: 0.055 },
      ]

      for (let i = 0; i < neonDefs.length; i++) {
        const n = neonDefs[i]
        const hue = (seededRandom(i * 2.3 + neonFrame * 0.08) * 360)
        const nx = W * n.x
        const ny = vpY * n.y
        const nw = W * n.w
        const nh = vpY * n.h
        ctx.globalAlpha = 0.9
        ctx.fillStyle = `hsl(${Math.round(hue)}, 100%, 55%)`
        ctx.fillRect(nx, ny, nw, nh)
        ctx.globalAlpha = 0.2
        ctx.fillStyle = `hsl(${Math.round(hue)}, 100%, 70%)`
        ctx.fillRect(nx - 4, ny - 4, nw + 8, nh + 8)
        ctx.globalAlpha = 1
      }

      // Smog layer: semi-transparent band shifting position in hops
      const smogOffset = (smogFrame % 6) * W * 0.04
      ctx.globalAlpha = 0.15
      ctx.fillStyle = '#88aacc'
      ctx.fillRect(-smogOffset, vpY * 0.88, W * 1.3, vpY * 0.10)
      ctx.globalAlpha = 0.10
      ctx.fillStyle = '#aabbdd'
      ctx.fillRect(-smogOffset * 0.5 + W * 0.1, vpY * 0.76, W * 1.2, vpY * 0.08)
      ctx.globalAlpha = 1
    }
  }
}
