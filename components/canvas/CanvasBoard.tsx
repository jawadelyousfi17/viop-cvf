'use client'

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { SCENE_H, SCENE_W, type Scene } from '@/lib/lesson'
import { layoutScene, type Placed } from '@/lib/canvas-layout'
import { renderScene } from './render'

export interface BoardHandle {
  /** Reveals shapes whose scheduled time has passed, at `seconds` into the scene. */
  setTime: (seconds: number, schedule: Map<string, number>) => void
  /** Swaps to a scene, laying it out fresh. */
  setScene: (scene: Scene, sceneIndex: number) => void
  /** Registers a decoded photograph against its search query. */
  addImage: (query: string, image: HTMLImageElement) => void
}

const REVEAL_SECONDS = 0.55

/**
 * The whole board, painted on a 2D canvas.
 *
 * Unlike the tldraw engine there is no shape database and no editor — one
 * animation loop clears and repaints the current scene each frame. That costs
 * the ability to grab and move shapes afterwards, and buys exact control over
 * layout, which is what stops labels landing on each other.
 */
export default function CanvasBoard({
  ref,
  onReady,
}: {
  ref: Ref<BoardHandle>
  /**
   * Fired once the canvas has a context and a size. The board is loaded
   * dynamically, so it mounts after the player's scene effect has already
   * run — without this signal the first scene is never handed over and the
   * board stays empty for the whole lesson.
   */
  onReady?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const placedRef = useRef<Placed[]>([])
  const imagesRef = useRef(new Map<string, HTMLImageElement>())
  const timeRef = useRef(0)
  const scheduleRef = useRef(new Map<string, number>())
  const sceneRef = useRef<Scene | null>(null)
  /** Camera: a scene index the view eases towards, so scenes scroll past. */
  const cameraRef = useRef({ current: 0, target: 0 })

  useImperativeHandle(ref, () => ({
    setTime(seconds, schedule) {
      timeRef.current = seconds
      scheduleRef.current = schedule
    },
    setScene(scene, sceneIndex) {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return
      sceneRef.current = scene
      placedRef.current = layoutScene(ctx, scene)
      cameraRef.current.target = sceneIndex
      timeRef.current = 0
    },
    addImage(query, image) {
      imagesRef.current.set(query.trim().toLowerCase(), image)
    },
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    let disposed = false

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const { clientWidth: w, clientHeight: h } = canvas
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      // Re-measure: wrapping depends on the context, which resize resets.
      if (sceneRef.current) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        placedRef.current = layoutScene(ctx, sceneRef.current)
      }
    }

    const draw = () => {
      if (disposed) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = canvas.clientWidth
      const h = canvas.clientHeight

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      paintGrid(ctx, w, h)

      // Fit the scene box into the area the controls do not cover.
      const usableH = h - 96 - 130
      const scale = Math.min(w / (SCENE_W + 120), usableH / SCENE_H)
      const camera = cameraRef.current
      camera.current += (camera.target - camera.current) * 0.11

      ctx.save()
      ctx.translate(
        (w - SCENE_W * scale) / 2,
        96 + (usableH - SCENE_H * scale) / 2 - (camera.current - camera.target) * SCENE_H * scale * 1.15
      )
      ctx.scale(scale, scale)

      const progress = new Map<string, number>()
      for (const [id, at] of scheduleRef.current) {
        progress.set(id, Math.max(0, Math.min(1, (timeRef.current - at) / REVEAL_SECONDS)))
      }
      renderScene(ctx, placedRef.current, { progress, images: imagesRef.current })
      ctx.restore()

      frame = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    frame = requestAnimationFrame(draw)
    onReady?.()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [onReady])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
}

/** The faint dot grid, so shapes sit on a surface rather than on white. */
function paintGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  ctx.fillStyle = '#c8ccd4'
  const step = 26
  for (let x = step; x < w; x += step) {
    for (let y = step; y < h; y += step) {
      ctx.fillRect(x, y, 1.4, 1.4)
    }
  }
  ctx.restore()
}
