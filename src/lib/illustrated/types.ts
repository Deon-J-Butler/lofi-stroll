export interface FrameState {
  t: number
  sceneId: string
  canvasW: number
  canvasH: number
  lighting?: 'day' | 'night'
}
