import { describe, expect, it } from 'vitest'
import {
  BACKGROUND_CYCLE_SECONDS,
  BACKGROUND_HOLD_ZOOM,
  BACKGROUND_TRANSITION_MS,
  CHARACTER_FPS,
  CHARACTER_FRAMES,
  CHARACTER_MOTION,
  getSceneBackgroundFrames,
  SCENE_IDS
} from './sceneFrames'

describe('illustrated animation pacing', () => {
  it('keeps the walk relaxed and grounded', () => {
    expect(CHARACTER_FPS).toBeLessThanOrEqual(6)
    expect(
      Math.max(...CHARACTER_MOTION.map((motion) => Math.abs(motion.y)))
    ).toBeLessThanOrEqual(0.7)
  })

  it('uses the painterly character frame set', () => {
    expect(CHARACTER_FRAMES).toHaveLength(12)
    expect(CHARACTER_FRAMES.every((frame) => frame.includes('walk-v3'))).toBe(
      true
    )
  })

  it('keeps background movement slow and smooth', () => {
    expect(BACKGROUND_CYCLE_SECONDS).toBeGreaterThanOrEqual(48)
    expect(BACKGROUND_TRANSITION_MS).toBeGreaterThanOrEqual(1800)
    expect(BACKGROUND_HOLD_ZOOM).toBeGreaterThanOrEqual(1.03)
    expect(BACKGROUND_HOLD_ZOOM).toBeLessThanOrEqual(1.045)
  })

  it('provides day and night frames for every 2D scene', () => {
    for (const sceneId of SCENE_IDS) {
      expect(getSceneBackgroundFrames(sceneId, 'day')).toHaveLength(8)
      expect(getSceneBackgroundFrames(sceneId, 'night')).toHaveLength(8)
    }
  })
})
