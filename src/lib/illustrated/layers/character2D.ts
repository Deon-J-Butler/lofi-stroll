// src/lib/illustrated/layers/character2D.ts
import { createStopMotionClock } from '../stopMotion'
import { roughFill, hatchShadow } from '../sketch'
import type { FrameState } from '../types'

const SKIN = '#96603c'
const HOODIE = '#111111'
const DENIM = '#3b5a8f'
const SNEAKER = '#161616'
const SNEAKER_CREAM = '#e7e0d0'
const SNEAKER_RED = '#c24a5a'
const INK = '#0d0618'
const CAP = '#f2f0e8'

// Pose table: 8 frames of a walk cycle seen from behind
// bob: vertical offset fraction of s (negative = down)
// sway: horizontal offset fraction of s
// legL/legR: thigh angle from vertical in radians (+ = forward/right)
// kneeL/kneeR: knee bend in radians (always >= 0)
// armL/armR: shoulder angle from vertical in radians (+ = forward)
interface WalkPose {
  bob: number; sway: number
  legL: number; kneeL: number
  legR: number; kneeR: number
  armL: number; armR: number
  headTilt: number
}

const POSES: WalkPose[] = [
  { bob: 0,     sway: 0,     legL:  0.35, kneeL: 0,    legR: -0.35, kneeR: 0.35, armL: -0.28, armR:  0.28, headTilt:  0.04 },
  { bob: -0.04, sway: 0.04,  legL:  0.20, kneeL: 0.20, legR: -0.20, kneeR: 0.10, armL: -0.18, armR:  0.18, headTilt:  0.02 },
  { bob: -0.08, sway: 0.08,  legL:  0,    kneeL: 0.30, legR:  0,    kneeR: 0,    armL:  0,    armR:  0,    headTilt:  0    },
  { bob: -0.04, sway: 0.04,  legL: -0.20, kneeL: 0.10, legR:  0.20, kneeR: 0.20, armL:  0.18, armR: -0.18, headTilt: -0.02 },
  { bob: 0,     sway: 0,     legL: -0.35, kneeL: 0.35, legR:  0.35, kneeR: 0,    armL:  0.28, armR: -0.28, headTilt: -0.04 },
  { bob: -0.04, sway: -0.04, legL: -0.20, kneeL: 0.10, legR:  0.20, kneeR: 0.20, armL:  0.18, armR: -0.18, headTilt: -0.02 },
  { bob: -0.08, sway: -0.08, legL:  0,    kneeL: 0,    legR:  0,    kneeR: 0.30, armL:  0,    armR:  0,    headTilt:  0    },
  { bob: -0.04, sway: -0.04, legL:  0.20, kneeL: 0.20, legR: -0.20, kneeR: 0.10, armL: -0.18, armR:  0.18, headTilt:  0.02 },
]

// Draw a rounded-rectangle limb. cx,cy = centre, w,h = dimensions, angle = rotation from vertical
function drawLimb(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, color: string, seed: number) {
  const points: [number, number][] = [
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ]
  roughFill(ctx, points, color, INK, seed)
}

// Draw a foot/sneaker shape
function drawFoot(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, facing: -1 | 1, seed: number) {
  const fw = s * 0.18
  const fh = s * 0.08
  const ox = facing * fw * 0.3 // offset toe direction
  // Sole
  roughFill(ctx, [
    [cx - fw / 2 + ox, cy - fh * 0.4],
    [cx + fw / 2 + ox, cy - fh * 0.4],
    [cx + fw * 0.55 + ox, cy + fh * 0.6],
    [cx - fw * 0.45 + ox, cy + fh * 0.6],
  ], SNEAKER, INK, seed)
  // Cream midsole stripe
  roughFill(ctx, [
    [cx - fw / 2 + ox + 1, cy - fh * 0.1],
    [cx + fw / 2 + ox - 1, cy - fh * 0.1],
    [cx + fw / 2 + ox - 1, cy + fh * 0.1],
    [cx - fw / 2 + ox + 1, cy + fh * 0.1],
  ], SNEAKER_CREAM, SNEAKER_CREAM, seed + 1)
  // Red swoosh
  roughFill(ctx, [
    [cx - fw * 0.1 + ox, cy - fh * 0.3],
    [cx + fw * 0.35 + ox, cy - fh * 0.4],
    [cx + fw * 0.4 + ox, cy],
    [cx - fw * 0.1 + ox, cy - fh * 0.1],
  ], SNEAKER_RED, SNEAKER_RED, seed + 2)
}

export interface Character2DLayer {
  draw(ctx: CanvasRenderingContext2D, state: FrameState): void
}

export function createCharacter2D(): Character2DLayer {
  const clock = createStopMotionClock(8)
  const noteClock = createStopMotionClock(7)

  return {
    draw(ctx: CanvasRenderingContext2D, state: FrameState) {
      ctx.save()
      const { t, canvasW: W, canvasH: H } = state
      const frame = clock.tick(t)
      const noteFrame = noteClock.tick(t)
      const pose = POSES[frame % 8]
      const seed = frame * 13.7

      const s = H * 0.22
      const cx = W * 0.5 + pose.sway * s
      const cy = H * 0.78 + pose.bob * s

      // Skeleton key Y positions (from bottom of character up)
      const hipY = cy - s * 0.50
      const pelvisY = hipY
      const spineTopY = hipY - s * 0.36
      const shoulderY = spineTopY
      const neckY = spineTopY - s * 0.06
      const headY = neckY - s * 0.18

      const thighLen = s * 0.26
      const calfLen = s * 0.24
      const upperArmLen = s * 0.20
      const foreArmLen = s * 0.18

      const hipSpread = s * 0.10
      const shoulderSpread = s * 0.22

      // Helper: compute knee position from hip, thigh angle, and calf angle
      function legKneePos(hipX: number, hipY: number, thighAngle: number): [number, number] {
        return [hipX + Math.sin(thighAngle) * thighLen, hipY + Math.cos(thighAngle) * thighLen]
      }
      function legAnklePos(kneeX: number, kneeY: number, thighAngle: number, kneeBend: number): [number, number] {
        const totalAngle = thighAngle - kneeBend
        return [kneeX + Math.sin(totalAngle) * calfLen, kneeY + Math.cos(totalAngle) * calfLen]
      }

      const hipLX = cx - hipSpread + Math.sin(pose.legL) * s * 0.05
      const hipRX = cx + hipSpread + Math.sin(pose.legR) * s * 0.05

      const [kneeLX, kneeLY] = legKneePos(hipLX, hipY, pose.legL)
      const [kneeRX, kneeRY] = legKneePos(hipRX, hipY, pose.legR)
      const [ankleLX, ankleLY] = legAnklePos(kneeLX, kneeLY, pose.legL, pose.kneeL)
      const [ankleRX, ankleRY] = legAnklePos(kneeRX, kneeRY, pose.legR, pose.kneeR)

      const shoulderLX = cx - shoulderSpread
      const shoulderRX = cx + shoulderSpread

      function armElbowPos(shoulderX: number, angle: number): [number, number] {
        return [shoulderX + Math.sin(angle) * upperArmLen, shoulderY + Math.cos(angle) * upperArmLen]
      }
      function armHandPos(elbowX: number, elbowY: number, angle: number): [number, number] {
        return [elbowX + Math.sin(angle * 0.5) * foreArmLen, elbowY + Math.cos(angle * 0.5) * foreArmLen]
      }

      const [elbowLX, elbowLY] = armElbowPos(shoulderLX, pose.armL)
      const [elbowRX, elbowRY] = armElbowPos(shoulderRX, pose.armR)
      const [handLX, handLY] = armHandPos(elbowLX, elbowLY, pose.armL)
      const [handRX, handRY] = armHandPos(elbowRX, elbowRY, pose.armR)

      const w = s * 0.11  // limb width

      // ---- Draw back-to-front ----

      // Back leg (right leg when pose.legR angle puts it visually behind)
      const backIsRight = pose.legR < pose.legL
      if (backIsRight) {
        // Right leg behind
        drawLimb(ctx, (hipRX + kneeRX) / 2, (hipY + kneeRY) / 2, w * 1.1, thighLen, DENIM, seed + 100)
        drawLimb(ctx, (kneeRX + ankleRX) / 2, (kneeRY + ankleRY) / 2, w, calfLen, DENIM, seed + 101)
        drawFoot(ctx, ankleRX, ankleRY, s, 1, seed + 102)
      } else {
        drawLimb(ctx, (hipLX + kneeLX) / 2, (hipY + kneeLY) / 2, w * 1.1, thighLen, DENIM, seed + 110)
        drawLimb(ctx, (kneeLX + ankleLX) / 2, (kneeLY + ankleLY) / 2, w, calfLen, DENIM, seed + 111)
        drawFoot(ctx, ankleLX, ankleLY, s, -1, seed + 112)
      }

      // Shorts / pelvis
      roughFill(ctx, [
        [cx - s * 0.16, hipY - s * 0.02],
        [cx + s * 0.16, hipY - s * 0.02],
        [cx + s * 0.14, hipY + s * 0.14],
        [cx - s * 0.14, hipY + s * 0.14],
      ], DENIM, INK, seed + 200)

      // Torso (hoodie back)
      roughFill(ctx, [
        [cx - s * 0.18, spineTopY],
        [cx + s * 0.18, spineTopY],
        [cx + s * 0.16, pelvisY],
        [cx - s * 0.16, pelvisY],
      ], HOODIE, INK, seed + 210)
      hatchShadow(ctx, cx - s * 0.18, spineTopY, s * 0.06, spineTopY - pelvisY, seed + 211)

      // Back arm (left arm when it's behind the body)
      const backArmIsLeft = pose.armL > 0
      if (backArmIsLeft) {
        drawLimb(ctx, (shoulderLX + elbowLX) / 2, (shoulderY + elbowLY) / 2, w * 0.9, upperArmLen, HOODIE, seed + 300)
        drawLimb(ctx, (elbowLX + handLX) / 2, (elbowLY + handLY) / 2, w * 0.8, foreArmLen, HOODIE, seed + 301)
        roughFill(ctx, [
          [handLX - s * 0.06, handLY - s * 0.06],
          [handLX + s * 0.06, handLY - s * 0.06],
          [handLX + s * 0.06, handLY + s * 0.06],
          [handLX - s * 0.06, handLY + s * 0.06],
        ], SKIN, INK, seed + 302)
      } else {
        drawLimb(ctx, (shoulderRX + elbowRX) / 2, (shoulderY + elbowRY) / 2, w * 0.9, upperArmLen, HOODIE, seed + 310)
        drawLimb(ctx, (elbowRX + handRX) / 2, (elbowRY + handRY) / 2, w * 0.8, foreArmLen, HOODIE, seed + 311)
        roughFill(ctx, [
          [handRX - s * 0.06, handRY - s * 0.06],
          [handRX + s * 0.06, handRY - s * 0.06],
          [handRX + s * 0.06, handRY + s * 0.06],
          [handRX - s * 0.06, handRY + s * 0.06],
        ], SKIN, INK, seed + 312)
      }

      // Hood / head area
      // Hood dome
      roughFill(ctx, [
        [cx - s * 0.22, neckY],
        [cx + s * 0.22, neckY],
        [cx + s * 0.26, headY - s * 0.10],
        [cx, headY - s * 0.24],
        [cx - s * 0.26, headY - s * 0.10],
      ], HOODIE, INK, seed + 400)

      // Head
      ctx.beginPath()
      ctx.ellipse(
        cx + pose.headTilt * s * 0.04,
        headY,
        s * 0.14,
        s * 0.16,
        pose.headTilt * 0.1,
        0, Math.PI * 2
      )
      ctx.fillStyle = SKIN
      ctx.fill()
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.stroke()

      // Backward cap (brim points forward = downward in back view)
      roughFill(ctx, [
        [cx - s * 0.15, headY - s * 0.14],
        [cx + s * 0.15, headY - s * 0.14],
        [cx + s * 0.13, headY - s * 0.02],
        [cx - s * 0.13, headY - s * 0.02],
      ], CAP, INK, seed + 410)
      // Cap brim (front brim, faces away from camera = appears below the hat crown)
      roughFill(ctx, [
        [cx - s * 0.11, headY - s * 0.02],
        [cx + s * 0.11, headY - s * 0.02],
        [cx + s * 0.14, headY + s * 0.04],
        [cx - s * 0.14, headY + s * 0.04],
      ], CAP, INK, seed + 411)

      // Headphone band
      ctx.strokeStyle = '#222222'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(cx, headY - s * 0.06, s * 0.18, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
      // Ear cups
      for (const side of [-1, 1] as const) {
        roughFill(ctx, [
          [cx + side * s * 0.17, headY - s * 0.10],
          [cx + side * s * 0.21, headY - s * 0.10],
          [cx + side * s * 0.21, headY - s * 0.02],
          [cx + side * s * 0.17, headY - s * 0.02],
        ], '#222222', INK, seed + 420 + side)
      }

      // Front leg (on top)
      if (backIsRight) {
        drawLimb(ctx, (hipLX + kneeLX) / 2, (hipY + kneeLY) / 2, w * 1.1, thighLen, DENIM, seed + 500)
        drawLimb(ctx, (kneeLX + ankleLX) / 2, (kneeLY + ankleLY) / 2, w, calfLen, DENIM, seed + 501)
        drawFoot(ctx, ankleLX, ankleLY, s, -1, seed + 502)
      } else {
        drawLimb(ctx, (hipRX + kneeRX) / 2, (hipY + kneeRY) / 2, w * 1.1, thighLen, DENIM, seed + 510)
        drawLimb(ctx, (kneeRX + ankleRX) / 2, (kneeRY + ankleRY) / 2, w, calfLen, DENIM, seed + 511)
        drawFoot(ctx, ankleRX, ankleRY, s, 1, seed + 512)
      }

      // Front arm (on top)
      if (backArmIsLeft) {
        drawLimb(ctx, (shoulderRX + elbowRX) / 2, (shoulderY + elbowRY) / 2, w * 0.9, upperArmLen, HOODIE, seed + 600)
        drawLimb(ctx, (elbowRX + handRX) / 2, (elbowRY + handRY) / 2, w * 0.8, foreArmLen, HOODIE, seed + 601)
        roughFill(ctx, [
          [handRX - s * 0.06, handRY - s * 0.06],
          [handRX + s * 0.06, handRY - s * 0.06],
          [handRX + s * 0.06, handRY + s * 0.06],
          [handRX - s * 0.06, handRY + s * 0.06],
        ], SKIN, INK, seed + 602)
      } else {
        drawLimb(ctx, (shoulderLX + elbowLX) / 2, (shoulderY + elbowLY) / 2, w * 0.9, upperArmLen, HOODIE, seed + 610)
        drawLimb(ctx, (elbowLX + handLX) / 2, (elbowLY + handLY) / 2, w * 0.8, foreArmLen, HOODIE, seed + 611)
        roughFill(ctx, [
          [handLX - s * 0.06, handLY - s * 0.06],
          [handLX + s * 0.06, handLY - s * 0.06],
          [handLX + s * 0.06, handLY + s * 0.06],
          [handLX - s * 0.06, handLY + s * 0.06],
        ], SKIN, INK, seed + 612)
      }

      // Floating music notes
      const noteSymbols = ['♪', '♫']
      const noteHues = [0.86, 0.12, 0.72]
      ctx.font = `bold ${Math.round(s * 0.28)}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let i = 0; i < 3; i++) {
        const life = ((noteFrame * 0.07 + i / 3) % 1)
        const side = i % 2 === 0 ? -1 : 1
        const nx = cx + side * (s * 0.6 + life * s * 0.5 + Math.sin(t * 1.2 + i * 2) * s * 0.08)
        const ny = cy - s * 0.6 - life * s * 0.9
        const hue = noteHues[i % 3]
        ctx.globalAlpha = (1 - life) * 0.85
        ctx.strokeStyle = 'rgba(10,6,20,0.9)'
        ctx.lineWidth = 4
        ctx.strokeText(noteSymbols[i % 2], nx, ny)
        ctx.fillStyle = `hsl(${Math.round(hue * 360)}, 65%, 62%)`
        ctx.fillText(noteSymbols[i % 2], nx, ny)
        ctx.globalAlpha = 1
      }
      ctx.restore()
    }
  }
}
