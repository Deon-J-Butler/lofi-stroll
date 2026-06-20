import { createStopMotionClock } from '../../stopMotion'
import { roughFill, seededRandom } from '../../sketch'
import type { FrameState } from '../../types'

export interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

export function createJungle2D(): SceneLayer {
  const canopyClock = createStopMotionClock(5)
  const lightClock = createStopMotionClock(6)
  const fireflyClock = createStopMotionClock(4)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { t, canvasW: W, canvasH: H } = state
      const canopyFrame = canopyClock.tick(t)
      const lightFrame = lightClock.tick(t)
      const fireflyFrame = fireflyClock.tick(t)
      const vpY = H * 0.42

      // Sky: warm amber
      const grad = ctx.createLinearGradient(0, 0, 0, vpY)
      grad.addColorStop(0, '#3a1800')
      grad.addColorStop(0.6, '#c05010')
      grad.addColorStop(1, '#e08030')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, vpY)

      // Background tree silhouettes (3 layers, each sways at canopy clock)
      const layers = [
        { color: '#0a1a04', count: 6, minH: 0.55, maxH: 0.75, spread: 0.18 },
        { color: '#122208', count: 8, minH: 0.65, maxH: 0.88, spread: 0.14 },
        { color: '#1a3010', count: 10, minH: 0.72, maxH: 0.95, spread: 0.12 },
      ]

      for (let li = 0; li < layers.length; li++) {
        const layer = layers[li]
        const sway = (canopyFrame % 4 < 2 ? 1 : -1) * W * layer.spread * 0.012

        for (let i = 0; i < layer.count; i++) {
          const seed = li * 100 + i * 7.3
          const tx = (seededRandom(seed) * 1.1 - 0.05) * W
          const th = (layer.minH + seededRandom(seed + 1) * (layer.maxH - layer.minH)) * vpY
          const tw = W * (0.06 + seededRandom(seed + 2) * 0.06)

          // Trunk
          roughFill(ctx, [
            [tx - tw * 0.08, vpY],
            [tx + tw * 0.08, vpY],
            [tx + tw * 0.06 + sway, vpY - th * 0.5],
            [tx - tw * 0.06 + sway, vpY - th * 0.5],
          ], layer.color, layer.color, seed + 10)

          // Canopy blob (shifts with sway)
          ctx.beginPath()
          ctx.ellipse(tx + sway, vpY - th, tw * 0.8, th * 0.45, 0, 0, Math.PI * 2)
          ctx.fillStyle = layer.color
          ctx.fill()
        }
      }

      // Dappled light patches on road area
      ctx.globalAlpha = 0.12
      ctx.fillStyle = '#ffcc44'
      for (let i = 0; i < 8; i++) {
        const seed = lightFrame * 11.3 + i * 5.7
        const lx = W * (0.15 + seededRandom(seed) * 0.7)
        const ly = vpY + (seededRandom(seed + 1) * 0.6 + 0.1) * (H - vpY)
        const lw = W * (0.02 + seededRandom(seed + 2) * 0.04)
        ctx.beginPath()
        ctx.ellipse(lx, ly, lw, lw * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // Fireflies: small bright dots blinking on/off
      for (let i = 0; i < 12; i++) {
        const seed = i * 13.1
        const fx = W * (0.05 + seededRandom(seed) * 0.9)
        const fy = vpY * (0.1 + seededRandom(seed + 1) * 0.85)
        const on = Math.floor(seededRandom(seed + fireflyFrame * 0.7) * 3) !== 0
        if (on) {
          ctx.beginPath()
          ctx.arc(fx, fy, 2, 0, Math.PI * 2)
          ctx.fillStyle = '#aaff88'
          ctx.globalAlpha = 0.7 + seededRandom(seed + fireflyFrame) * 0.3
          ctx.fill()
          ctx.globalAlpha = 0.15
          ctx.beginPath()
          ctx.arc(fx, fy, 6, 0, Math.PI * 2)
          ctx.fillStyle = '#88ff66'
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }
    }
  }
}
