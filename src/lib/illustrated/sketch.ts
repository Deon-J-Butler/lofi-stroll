export function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1.618) * 43758.5453
  return x - Math.floor(x)
}

export function jitterLine(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  x1: number, y1: number,
  seed: number,
  amount: number
): void {
  ctx.beginPath()
  ctx.moveTo(
    x0 + (seededRandom(seed) - 0.5) * amount,
    y0 + (seededRandom(seed + 0.3) - 0.5) * amount
  )
  ctx.lineTo(
    x1 + (seededRandom(seed + 0.6) - 0.5) * amount,
    y1 + (seededRandom(seed + 0.9) - 0.5) * amount
  )
  ctx.stroke()
}

export function roughFill(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  fillColor: string,
  inkColor: string,
  seed: number
): void {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
  ctx.closePath()
  ctx.fillStyle = fillColor
  ctx.fill()

  ctx.strokeStyle = inkColor
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(
    points[0][0] + (seededRandom(seed) - 0.5) * 4,
    points[0][1] + (seededRandom(seed + 0.1) - 0.5) * 4
  )
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(
      points[i][0] + (seededRandom(seed + i) - 0.5) * 4,
      points[i][1] + (seededRandom(seed + i + 0.1) - 0.5) * 4
    )
  }
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

export function hatchShadow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  seed: number,
  density = 6
): void {
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1
  for (let i = 0; i < density; i++) {
    const t = (i + seededRandom(seed + i) * 0.5) / density
    const lx = x + t * w
    ctx.beginPath()
    ctx.moveTo(lx, y)
    ctx.lineTo(lx - h * 0.25, y + h)
    ctx.stroke()
  }
  ctx.restore()
}
