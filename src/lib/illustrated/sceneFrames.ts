export const CHARACTER_FPS = 5
export const BACKGROUND_CYCLE_SECONDS = 56
export const BACKGROUND_TRANSITION_MS = 2400
export const BACKGROUND_HOLD_ZOOM = 1.035
export const SCENE_IDS = ['trippy-90s', 'jungle', 'metropolis'] as const
export const LIGHTING_MODES = ['day', 'night'] as const

export type IllustratedLighting = (typeof LIGHTING_MODES)[number]

const characterModules = import.meta.glob(
  './assets/character/walk-v3/*.png',
  { eager: true, import: 'default' }
) as Record<string, string>

const backgroundModules = import.meta.glob(
  './assets/background-frames/*/frame-??.webp',
  { eager: true, import: 'default' }
) as Record<string, string>

const SCENE_VARIANT_FOLDERS: Record<
  string,
  Record<IllustratedLighting, string>
> = {
  'trippy-90s': {
    day: 'trippy-90s',
    night: 'trippy-90s-night'
  },
  jungle: {
    day: 'jungle',
    night: 'jungle-night'
  },
  metropolis: {
    day: 'metropolis-day',
    night: 'metropolis'
  }
}

function framesForFolder(folder: string): readonly string[] {
  return Object.entries(backgroundModules)
    .filter(([path]) => path.includes(`/${folder}/`))
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
    .map(([, src]) => src)
}

export const SCENE_BACKGROUND_VARIANTS: Record<
  string,
  Record<IllustratedLighting, readonly string[]>
> = Object.fromEntries(
  SCENE_IDS.map((sceneId) => [
    sceneId,
    {
      day: framesForFolder(SCENE_VARIANT_FOLDERS[sceneId].day),
      night: framesForFolder(SCENE_VARIANT_FOLDERS[sceneId].night)
    }
  ])
)

export function getSceneBackgroundFrames(
  sceneId: string,
  lighting: IllustratedLighting
): readonly string[] {
  const normalizedSceneId = normalizeSceneId(sceneId)
  return SCENE_BACKGROUND_VARIANTS[normalizedSceneId][lighting]
}

export const CHARACTER_FRAMES = Object.entries(characterModules)
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([, src]) => src)

export const CHARACTER_MOTION = [
  { x: -0.2, y: 0.05, rotate: -0.06 },
  { x: -0.4, y: 0.3, rotate: -0.12 },
  { x: -0.3, y: 0.6, rotate: -0.08 },
  { x: 0, y: 0.3, rotate: 0 },
  { x: 0.3, y: 0.05, rotate: 0.08 },
  { x: 0.4, y: -0.1, rotate: 0.12 },
  { x: 0.2, y: 0.05, rotate: 0.06 },
  { x: 0.4, y: 0.3, rotate: 0.12 },
  { x: 0.3, y: 0.6, rotate: 0.08 },
  { x: 0, y: 0.3, rotate: 0 },
  { x: -0.3, y: 0.05, rotate: -0.08 },
  { x: -0.4, y: -0.1, rotate: -0.12 }
] as const

export function normalizeSceneId(sceneId: string): string {
  return SCENE_BACKGROUND_VARIANTS[sceneId] ? sceneId : 'trippy-90s'
}
