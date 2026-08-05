'use client'

import { useEffect, useRef } from 'react'

/** How far the picture may drift from the voice before it is nudged back. */
const MAX_DRIFT = 0.25

/**
 * A rendered scene, kept in step with the narration.
 *
 * The audio is the clock — it is the thing a listener notices stuttering — so
 * the video follows it. Small drift is normal and left alone; a seek only
 * happens past a quarter second, because correcting every frame would show as
 * a visible judder.
 */
export default function ManimVideo({
  src,
  playing,
  audioTime,
}: {
  src: string
  playing: boolean
  /** Where the voice has reached, in seconds. */
  audioTime: () => number
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let frame = 0
    const tick = () => {
      const target = audioTime()
      if (Number.isFinite(target) && Math.abs(video.currentTime - target) > MAX_DRIFT) {
        video.currentTime = target
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [audioTime])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (playing) void video.play().catch(() => {})
    else video.pause()
  }, [playing, src])

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      playsInline
      preload="auto"
      className="absolute inset-0 h-full w-full object-contain"
    />
  )
}
