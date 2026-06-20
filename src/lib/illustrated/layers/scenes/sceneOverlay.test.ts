import { describe, it, expect, vi } from 'vitest'

// Mock the buildingCorridor module that jungle2D and metropolis2D import
vi.mock('../buildingCorridor', () => ({
  createBuildingCorridor: vi.fn(() => ({
    draw: vi.fn()
  }))
}))

import { createJungle2D } from './jungle2D'
import { createMetropolis2D } from './metropolis2D'

function makeCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(), restore: vi.fn(),
    fillRect: vi.fn(), fillStyle: '',
    globalAlpha: 1,
    beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(),
    fill: vi.fn(), clip: vi.fn(),
    strokeStyle: '', lineWidth: 0, stroke: vi.fn(),
    clearRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D
}

const baseState = { t: 0, sceneId: 'jungle', canvasW: 800, canvasH: 600 }

describe('jungle2D drawOverlay', () => {
  it('returns a scene with drawOverlay method', () => {
    const scene = createJungle2D()
    expect(typeof scene.drawOverlay).toBe('function')
  })

  it('drawOverlay runs without throwing at t=0', () => {
    const scene = createJungle2D()
    expect(() => scene.drawOverlay!(makeCtx(), baseState)).not.toThrow()
  })

  it('drawOverlay runs without throwing at t=10', () => {
    const scene = createJungle2D()
    expect(() => scene.drawOverlay!(makeCtx(), { ...baseState, t: 10 })).not.toThrow()
  })

  it('keeps daytime road light out of the night variant', () => {
    const scene = createJungle2D()
    const ctx = makeCtx()

    scene.drawOverlay!(ctx, {
      ...baseState,
      lighting: 'night'
    })

    expect(ctx.ellipse).not.toHaveBeenCalled()
  })
})

describe('metropolis2D drawOverlay', () => {
  it('returns a scene with drawOverlay method', () => {
    const scene = createMetropolis2D()
    expect(typeof scene.drawOverlay).toBe('function')
  })

  it('drawOverlay runs without throwing at t=0', () => {
    const scene = createMetropolis2D()
    expect(() => scene.drawOverlay!(makeCtx(), { ...baseState, sceneId: 'metropolis' })).not.toThrow()
  })
})

import { createTrippy90s2D } from './trippy90s2D'

describe('trippy90s2D drawOverlay', () => {
  it('returns a scene with drawOverlay method', () => {
    const scene = createTrippy90s2D()
    expect(typeof scene.drawOverlay).toBe('function')
  })

  it('drawOverlay runs without throwing at t=0', () => {
    const scene = createTrippy90s2D()
    expect(() =>
      scene.drawOverlay!(makeCtx(), { t: 0, sceneId: 'trippy-90s', canvasW: 800, canvasH: 600 })
    ).not.toThrow()
  })

  it('drawOverlay runs without throwing at t=30', () => {
    const scene = createTrippy90s2D()
    expect(() =>
      scene.drawOverlay!(makeCtx(), { t: 30, sceneId: 'trippy-90s', canvasW: 800, canvasH: 600 })
    ).not.toThrow()
  })

  it('leaves the painted background sun untouched', () => {
    const scene = createTrippy90s2D()
    const ctx = makeCtx()

    scene.drawOverlay!(ctx, {
      t: 0,
      sceneId: 'trippy-90s',
      canvasW: 800,
      canvasH: 600
    })

    expect(ctx.fillRect).not.toHaveBeenCalled()
    expect(ctx.clip).not.toHaveBeenCalled()
  })
})
