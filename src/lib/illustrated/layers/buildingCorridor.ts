import { roughFill, seededRandom } from '../sketch'
import type { FrameState } from '../types'

export interface BuildingType {
  widthMult: number
  heightMult: number
  windowCols: number
  windowRows: number
  accentColor?: string
}

export interface CorridorStyle {
  buildingColor: string
  inkColor: string
  windowLit: string
  windowDark: string
  buildingTypes: BuildingType[]
  drawFacade?: (ctx: CanvasRenderingContext2D, facade: FacadeGeometry) => void
}

export interface FacadeGeometry {
  x: number
  y: number
  width: number
  height: number
  side: 'left' | 'right'
  seed: number
  depth: number
  style: CorridorStyle
}

export interface BuildingCorridor {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

const BUILDING_COUNT = 6

export function createBuildingCorridor(style: CorridorStyle): BuildingCorridor {
  // Fixed deterministic layout for the life of this corridor instance
  const slots = Array.from({ length: BUILDING_COUNT }, (_, i) => ({
    depth: (i + 1) / (BUILDING_COUNT + 1),
    typeIndex: Math.floor(seededRandom(i * 7.3) * style.buildingTypes.length),
    seed: i * 13.7,
  })).reverse() // far → near so closer buildings paint on top

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      const { canvasW: W, canvasH: H } = state
      const vpX = W * 0.5
      const vpY = H * 0.42
      const roadHalfW = W * 0.46

      for (const { depth, typeIndex, seed } of slots) {
        const bType = style.buildingTypes[typeIndex % style.buildingTypes.length]
        const scale = depth
        const y = vpY + depth * (H - vpY)
        const bW = W * 0.10 * bType.widthMult * scale
        const bH = H * 0.20 * bType.heightMult * scale
        const leftEdge = vpX - roadHalfW * depth
        const rightEdge = vpX + roadHalfW * depth

        const leftFacade: FacadeGeometry = {
          x: leftEdge - bW, y: y - bH,
          width: bW, height: bH,
          side: 'left', seed, depth, style,
        }
        const rightFacade: FacadeGeometry = {
          x: rightEdge, y: y - bH,
          width: bW, height: bH,
          side: 'right', seed: seed + 100, depth, style,
        }

        if (style.drawFacade) {
          style.drawFacade(ctx, leftFacade)
          style.drawFacade(ctx, rightFacade)
        } else {
          drawDefaultFacade(ctx, leftFacade)
          drawDefaultFacade(ctx, rightFacade)
        }
      }
    },
  }
}

function drawDefaultFacade(ctx: CanvasRenderingContext2D, facade: FacadeGeometry) {
  const { x, y, width, height, seed, style } = facade
  const { buildingColor, inkColor, windowLit, windowDark } = style

  roughFill(ctx, [
    [x, y], [x + width, y], [x + width, y + height], [x, y + height],
  ], buildingColor, inkColor, seed)

  const cols = Math.max(1, Math.round(width / 9))
  const rows = Math.max(1, Math.round(height / 11))
  const wW = (width * 0.55) / cols
  const wH = (height * 0.55) / rows
  const gX = (width - cols * wW) / (cols + 1)
  const gY = (height - rows * wH) / (rows + 1)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + gX + c * (wW + gX)
      const wy = y + gY + r * (wH + gY)
      const lit = seededRandom(seed + r * 10 + c) > 0.4
      roughFill(ctx,
        [[wx, wy], [wx + wW, wy], [wx + wW, wy + wH], [wx, wy + wH]],
        lit ? windowLit : windowDark, inkColor, seed + r * 10 + c + 50)
    }
  }
}
