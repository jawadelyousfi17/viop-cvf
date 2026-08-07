'use client'

import { Tldraw, type Editor, type TLShapeId } from 'tldraw'
import 'tldraw/tldraw.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { captureScene, type BoardMeta } from '@/lib/board-capture'
import { phraseAt } from '@/lib/anchor'
import { estimateNarrationSeconds, type BoardShape, type Lesson, type ShapeKind } from '@/lib/lesson'
import { checkLesson, toDemoModule } from '@/lib/lesson-check'
import { parseScript } from '@/lib/script-import'
import { DEFAULT_VOICE_ID, VOICES, type VoiceId } from '@/lib/voices'
import type { SpeechResponse } from '@/app/api/tts/route'

const STORAGE_KEY = 'viop-author-v2'

/** Kinds you can tag a drawn shape as, that have no tldraw equivalent. */
const TAGGABLE: ShapeKind[] = [
  'image',
  'icon',
  'table',
  'array',
  'stack',
  'barchart',
  'linechart',
  'piechart',
  'label',
  'laser',
]

interface Track {
  id: string
  narration: string
  /** tldraw shape id -> when it was drawn, and what was being said. */
  timings: Record<string, { at: number; anchor: string }>
  /** tldraw's own store snapshot, so a scene round-trips without loss. */
  snapshot: unknown | null
  /**
   * The scene as board shapes, captured whenever this track is put away.
   *
   * Only one scene is on the canvas at a time, so an export has to read the
   * other six from somewhere. Capturing at stash time costs nothing and means
   * a lesson exports whole rather than exporting the scene you happen to be
   * looking at and six empty ones.
   */
  shapes: BoardShape[]
}

function blankTrack(index: number): Track {
  return {
    id: `scene-${index + 1}`,
    narration: '',
    timings: {},
    snapshot: null,
    shapes: [],
  }
}

interface Draft {
  title: string
  summary: string
  tracks: Track[]
}

const EMPTY: Draft = { title: 'Untitled board', summary: '', tracks: [blankTrack(0)] }

function savedDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Draft
    return parsed.tracks?.length ? parsed : EMPTY
  } catch {
    return EMPTY
  }
}

/**
 * A tool for drawing board lessons by hand.
 *
 * The board is tldraw's, with tldraw's own toolbar and shortcuts, full screen —
 * you draw the way you would in any drawing app. What this adds is a clock.
 *
 * Record the narration, then scrub it. Whatever you draw is stamped with the
 * moment you drew it, and — this is the point — with the words being spoken at
 * that moment. An anchor has to appear in the narration character for
 * character or the shape silently falls out of sync, and typing those by hand
 * is the most common way a board goes wrong. Drawn against a playing voice,
 * the anchor is read off the clock instead of typed.
 *
 * Scrub back and the board rewinds with you: anything drawn later fades out,
 * so you are always looking at the board as it will be at that instant.
 */
export default function AuthorStudio() {
  const [draft, setDraft] = useState<Draft>(savedDraft)
  const [index, setIndex] = useState(0)
  const [voiceId, setVoiceId] = useState<VoiceId>(DEFAULT_VOICE_ID)

  const [playing, setPlaying] = useState(false)
  const [head, setHead] = useState(0)
  const [duration, setDuration] = useState(8)
  const [alignment, setAlignment] = useState<SpeechResponse['alignment']>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [panel, setPanel] = useState(true)
  const [selected, setSelected] = useState<TLShapeId | null>(null)
  const [scriptOpen, setScriptOpen] = useState(false)
  const [scriptDraft, setScriptDraft] = useState('')

  const editorRef = useRef<Editor | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const frameRef = useRef(0)
  /** Mirrors state for the rAF loop and the store listener, which don't re-run. */
  const headRef = useRef(0)
  const durationRef = useRef(8)
  const alignRef = useRef<SpeechResponse['alignment']>(null)
  const timingsRef = useRef<Record<string, { at: number; anchor: string }>>({})
  const loadingRef = useRef(false)

  const track = draft.tracks[index]

  useEffect(() => {
    headRef.current = head
  }, [head])
  useEffect(() => {
    durationRef.current = duration
  }, [duration])
  useEffect(() => {
    alignRef.current = alignment
  }, [alignment])
  useEffect(() => {
    timingsRef.current = track?.timings ?? {}
  }, [track])

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
      } catch {
        // Over quota or private mode; not worth interrupting anyone for.
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [draft])

  function patchTrack(patch: Partial<Track>) {
    setDraft((prev) => {
      const tracks = [...prev.tracks]
      tracks[index] = { ...tracks[index], ...patch }
      return { ...prev, tracks }
    })
  }

  /** Saves whatever is on the canvas into the current track. */
  const stash = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    setDraft((prev) => {
      const tracks = [...prev.tracks]
      tracks[index] = {
        ...tracks[index],
        snapshot: editor.getSnapshot(),
        timings: timingsRef.current,
        shapes: captureScene(
          editor,
          editor.getCurrentPageShapes(),
          new Map(Object.entries(timingsRef.current))
        ),
      }
      return { ...prev, tracks }
    })
  }, [index])

  /**
   * Records every shape as it is drawn.
   *
   * Registered once, on mount: the handler reads the clock through refs so it
   * never needs re-registering, which would drop the drawing mid-stroke.
   */
  const onMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor
      // Light explicitly: the colour scheme is a browser-wide user preference,
      // so a board that does not claim one inherits whatever the last board
      // set — and the IT engine sets dark.
      editor.user.updateUserPreferences({ isSnapMode: false, colorScheme: 'light' })

      editor.sideEffects.registerAfterCreateHandler('shape', (shape, source) => {
        // Only what a person draws. Loading a snapshot creates shapes too, and
        // those already have their timings.
        if (source !== 'user' || loadingRef.current) return
        const at = Math.min(0.95, headRef.current / Math.max(0.1, durationRef.current))
        timingsRef.current = {
          ...timingsRef.current,
          [shape.id]: { at, anchor: phraseAt(alignRef.current, headRef.current) },
        }
      })

      editor.store.listen(() => setSelected(editor.getOnlySelectedShapeId()), {
        scope: 'session',
      })

      if (draft.tracks[0]?.snapshot) {
        loadingRef.current = true
        try {
          editor.loadSnapshot(draft.tracks[0].snapshot as never)
        } catch {
          // A snapshot from an older tldraw; start clean rather than crash.
        }
        loadingRef.current = false
      }
    },
    // Only the first track is loaded here; switching tracks is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  /** Moves to another scene, saving the one being left. */
  function goToScene(next: number) {
    const editor = editorRef.current
    if (!editor || next === index) return

    stash()
    stop()

    const target = draft.tracks[next]
    loadingRef.current = true
    try {
      if (target.snapshot) editor.loadSnapshot(target.snapshot as never)
      else editor.deleteShapes([...editor.getCurrentPageShapeIds()])
    } catch {
      editor.deleteShapes([...editor.getCurrentPageShapeIds()])
    }
    loadingRef.current = false

    timingsRef.current = target.timings ?? {}
    setIndex(next)
    setAlignment(null)
    setDuration(estimateNarrationSeconds(target.narration))
    setHead(0)
    audioRef.current = null
  }

  /**
   * Loads a whole written script, one scene per narration block.
   *
   * Appends rather than replaces, and never touches a track that already has
   * something drawn on it — an import is the start of a board, and losing an
   * afternoon's drawing to a paste is not a recoverable mistake.
   */
  function importScript(mode: 'append' | 'replace') {
    const parsed = parseScript(scriptDraft)
    if (!parsed.length) {
      setStatus('No narration found in that. Blockquotes, headed sections or blank-line paragraphs all work.')
      return
    }

    stash()
    setDraft((prev) => {
      const blank = (t: Track) => !t.narration.trim() && !t.shapes.length
      const kept = mode === 'replace' ? [] : prev.tracks.filter((t) => !blank(t))
      const added = parsed.map((scene, i) => ({
        ...blankTrack(kept.length + i),
        narration: scene.narration,
      }))
      return { ...prev, tracks: [...kept, ...added] }
    })

    setScriptOpen(false)
    setScriptDraft('')
    setStatus(`Loaded ${parsed.length} scenes. Open one, press Narrate, and draw along.`)
  }

  /** Fetches the voiceover, which is what gives the clock its meaning. */
  async function narrate() {
    if (!track.narration.trim()) {
      setStatus('Write the narration first — the clock comes from the voice.')
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: track.narration, voiceId }),
      })
      if (response.status === 501) {
        setStatus('No voice key configured. Timing falls back to reading speed.')
        setDuration(estimateNarrationSeconds(track.narration))
        return
      }
      if (!response.ok) throw new Error(String(response.status))

      const data = (await response.json()) as SpeechResponse
      const audio = new Audio(URL.createObjectURL(base64ToBlob(data.audio)))
      audio.preload = 'auto'
      await new Promise<void>((resolve) => {
        audio.addEventListener('loadedmetadata', () => resolve(), { once: true })
        setTimeout(resolve, 4000)
      })
      audioRef.current = audio
      const seconds = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : estimateNarrationSeconds(track.narration)
      setDuration(seconds)
      setAlignment(data.alignment)
      setHead(0)
      setStatus(
        data.alignment
          ? 'Ready. Draw while it plays and each shape takes the words being spoken.'
          : 'Voice ready, but this provider returned no timing — anchors will be blank.'
      )
    } catch {
      setStatus('Could not fetch the voiceover.')
    } finally {
      setBusy(false)
    }
  }

  const seek = useCallback((seconds: number) => {
    const next = Math.max(0, Math.min(durationRef.current, seconds))
    headRef.current = next
    setHead(next)
    if (audioRef.current) audioRef.current.currentTime = next
  }, [])

  function play() {
    const audio = audioRef.current
    setPlaying(true)
    if (audio) {
      audio.currentTime = headRef.current
      void audio.play().catch(() => setPlaying(false))
    }
    // Taken on the first frame rather than here: reading the clock while
    // rendering is impure, and the first frame is close enough to "now".
    let started = 0

    const tick = (now: number) => {
      if (!started) started = now - headRef.current * 1000
      const seconds = audio && !audio.paused ? audio.currentTime : (now - started) / 1000
      headRef.current = seconds
      setHead(seconds)
      if (seconds < durationRef.current) frameRef.current = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    frameRef.current = requestAnimationFrame(tick)
  }

  function stop() {
    cancelAnimationFrame(frameRef.current)
    audioRef.current?.pause()
    setPlaying(false)
  }

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  /**
   * Rewinds the board with the clock.
   *
   * Anything drawn after the playhead is dimmed rather than deleted, so you are
   * always looking at the board as it will be at this instant — and can still
   * grab something from the future to retime it.
   */
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const fraction = head / Math.max(0.1, duration)

    for (const shape of editor.getCurrentPageShapes()) {
      const timing = timingsRef.current[shape.id]
      const wanted = !timing || timing.at <= fraction + 0.001 ? 1 : 0.12
      if (shape.opacity !== wanted) {
        editor.updateShape({ id: shape.id, type: shape.type, opacity: wanted })
      }
    }
  }, [head, duration, index])

  // Only shift+arrow, which tldraw leaves alone. Every other transport control
  // is a button: this canvas belongs to the drawing tools, and a shortcut that
  // works everywhere except while you happen to be mid-stroke is worse than no
  // shortcut at all.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /INPUT|TEXTAREA/.test(target.tagName)) return

      // Space is deliberately not bound: tldraw pans the canvas while it is
      // held, and taking it away breaks moving around a board you are drawing.
      if (event.key === 'ArrowLeft' && event.shiftKey) {
        event.preventDefault()
        seek(headRef.current - 1)
      } else if (event.key === 'ArrowRight' && event.shiftKey) {
        event.preventDefault()
        seek(headRef.current + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seek])

  /** Retimes the selected shape to the playhead. */
  function stampSelected() {
    const editor = editorRef.current
    if (!editor || !selected) return
    const at = Math.min(0.95, head / Math.max(0.1, duration))
    timingsRef.current = {
      ...timingsRef.current,
      [selected]: { at, anchor: phraseAt(alignment, head) },
    }
    patchTrack({ timings: timingsRef.current })
    setStatus(`Retimed to ${head.toFixed(2)}s — "${phraseAt(alignment, head) || 'no anchor'}"`)
  }

  /** Tags the selected shape as a board kind tldraw cannot draw. */
  function tagSelected(kind: ShapeKind | '') {
    const editor = editorRef.current
    if (!editor || !selected) return
    const shape = editor.getShape(selected)
    if (!shape) return
    const meta: BoardMeta = kind ? { ...(shape.meta as BoardMeta), boardKind: kind } : {}
    editor.updateShape({ id: selected, type: shape.type, meta: meta as never })
    setStatus(kind ? `Tagged as "${kind}". Its text is the query or content.` : 'Tag removed.')
  }

  /** Everything, as the player's lesson. */
  const build = useCallback((): Lesson => {
    const editor = editorRef.current
    const tracks = draft.tracks.map((t, i) => ({ ...t, timings: i === index ? timingsRef.current : t.timings }))

    return {
      title: draft.title,
      summary: draft.summary,
      scenes: tracks.map((t, i) => {
        let shapes: Lesson['scenes'][number]['shapes'] = []
        if (editor && i === index) {
          shapes = captureScene(
            editor,
            editor.getCurrentPageShapes(),
            new Map(Object.entries(t.timings))
          )
        } else {
          // Captured when this scene was last put away. Only one scene is ever
          // on the canvas, so the rest are read from there.
          shapes = t.shapes ?? []
        }
        return {
          id: t.id,
          heading: '',
          narration: t.narration,
          diagram: { source: '', timing: [] },
          layout: 'fixed' as const,
          shapes,
        }
      }),
    }
  }, [draft, index])

  // Recomputed off the render path: build() reads the canvas and the timing
  // refs, neither of which is render state.
  const [report, setReport] = useState<ReturnType<typeof checkLesson> | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setReport(checkLesson(build()))
      } catch {
        setReport(null)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [build, head])

  function download(name: string, body: string, type: string) {
    const url = URL.createObjectURL(new Blob([body], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  const scriptPreview = scriptDraft.trim() ? parseScript(scriptDraft) : []
  const anchorNow = phraseAt(alignment, head)
  const fraction = head / Math.max(0.1, duration)
  const drawnCount = Object.keys(track?.timings ?? {}).length

  return (
    <main className="fixed inset-0 flex flex-col bg-zinc-950">
      {/* The board, with tldraw's own toolbar, shortcuts and menus. */}
      <div className="relative min-h-0 flex-1">
        <Tldraw onMount={onMount} />

        {/* The playhead, drawn over the canvas so it is visible while drawing. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[300] flex justify-center p-2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-black/10 bg-white/95 px-3 py-1.5 text-sm shadow-lg backdrop-blur">
            <span className="font-mono text-xs tabular-nums text-zinc-500">
              {head.toFixed(2)} / {duration.toFixed(1)}s
            </span>
            {anchorNow && (
              <span className="max-w-64 truncate rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                “{anchorNow}”
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Transport and scenes. */}
      <div className="shrink-0 border-t border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => seek(head - 5)} className={ghost} title="Back 5s">« 5s</button>
          <button onClick={() => seek(head - 1)} className={ghost} title="Back 1s (shift+←)">‹ 1s</button>
          <button
            onClick={() => (playing ? stop() : play())}
            className="rounded-lg bg-white px-4 py-1.5 font-medium text-zinc-900 transition hover:bg-zinc-200"
            title="Play / pause"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button onClick={() => seek(head + 1)} className={ghost} title="Forward 1s (shift+→)">1s ›</button>
          <button onClick={() => seek(head + 5)} className={ghost} title="Forward 5s">5s »</button>

          <input
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={head}
            onChange={(e) => seek(Number(e.target.value))}
            className="mx-2 min-w-40 flex-1 accent-white"
          />

          <span className="font-mono text-xs text-zinc-400">at {fraction.toFixed(2)}</span>

          <span className="mx-1 h-6 w-px bg-white/15" />

          <button onClick={narrate} disabled={busy} className={ghost}>
            {busy ? 'Narrating…' : alignment ? 'Re-narrate' : 'Narrate'}
          </button>
          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value as VoiceId)}
            className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-xs outline-none"
          >
            {VOICES.map((v) => (
              <option key={v.id} value={v.id} className="text-zinc-900">{v.name}</option>
            ))}
          </select>

          <span className="mx-1 h-6 w-px bg-white/15" />

          <button onClick={stampSelected} disabled={!selected} className={ghost} title="Retime the selected shape to the playhead">
            Stamp selection
          </button>
          <select
            value=""
            disabled={!selected}
            onChange={(e) => tagSelected(e.target.value as ShapeKind | '')}
            className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-xs outline-none disabled:opacity-40"
            title="Make the selected shape a board kind tldraw can't draw"
          >
            <option value="">tag as…</option>
            {TAGGABLE.map((k) => (
              <option key={k} value={k} className="text-zinc-900">{k}</option>
            ))}
            <option value="" className="text-zinc-900">— clear —</option>
          </select>

          <button onClick={() => setScriptOpen(true)} className={`${ghost} ml-auto`}>
            Load script
          </button>
          <button onClick={() => setPanel((p) => !p)} className={ghost}>
            {panel ? 'Hide script' : 'Script'}
          </button>
        </div>

        {panel && (
          <div className="mt-2 flex flex-wrap items-start gap-3">
            {/* Scenes */}
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap gap-1">
                {draft.tracks.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => goToScene(i)}
                    className={`rounded-lg px-2.5 py-1 text-xs transition ${i === index ? 'bg-white text-zinc-900' : 'bg-white/10 hover:bg-white/20'}`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => {
                    stash()
                    setDraft((prev) => ({ ...prev, tracks: [...prev.tracks, blankTrack(prev.tracks.length)] }))
                    setTimeout(() => goToScene(draft.tracks.length), 0)
                  }}
                  className="rounded-lg bg-white/10 px-2.5 py-1 text-xs transition hover:bg-white/20"
                >
                  +
                </button>
              </div>
              <span className="text-[11px] text-zinc-500">{drawnCount} timed</span>
            </div>

            {/* The script for this scene. */}
            <textarea
              value={track?.narration ?? ''}
              onChange={(e) => patchTrack({ narration: e.target.value })}
              rows={3}
              placeholder="What you say over this scene. Narrate it, then draw along."
              className="min-w-72 flex-1 resize-y rounded-lg border border-white/15 bg-white/5 p-2 text-xs leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/30"
            />

            {/* Lesson-level fields and export. */}
            <div className="flex w-64 flex-col gap-1.5">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Lesson title"
                className="rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs outline-none focus:border-white/30"
              />
              <input
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                placeholder="One-sentence summary"
                className="rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs outline-none focus:border-white/30"
              />
              <div className="flex gap-1.5">
                <button onClick={() => download('lesson.json', JSON.stringify(build(), null, 2), 'application/json')} className={`${ghost} flex-1`}>
                  JSON
                </button>
                <button onClick={() => download('demo-lesson.ts', toDemoModule(build()), 'text/plain')} className="flex-1 rounded-lg bg-white px-2 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200">
                  Export demo
                </button>
              </div>
              {report && (
                <span className={`text-[11px] ${report.errors ? 'text-red-400' : 'text-zinc-500'}`}>
                  {report.errors} errors · {report.warnings} warnings
                </span>
              )}
            </div>
          </div>
        )}

        {status && <p className="mt-1.5 text-[11px] text-zinc-400">{status}</p>}
      </div>

      {/* Paste a whole script in. Shows what it would produce before it does. */}
      {scriptOpen && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-black/70 p-6">
          <div className="flex max-h-full w-full max-w-3xl flex-col gap-3 rounded-2xl border border-white/15 bg-zinc-900 p-4 text-zinc-200">
            <div>
              <h2 className="text-sm font-medium">Load a script</h2>
              <p className="mt-1 text-xs text-zinc-400">
                One scene per narration block. Blockquotes, headed sections and blank-line
                paragraphs all work — as many scenes as the script has.
              </p>
            </div>

            <textarea
              value={scriptDraft}
              onChange={(e) => setScriptDraft(e.target.value)}
              autoFocus
              rows={10}
              placeholder="Paste the whole script here."
              className="min-h-0 flex-1 resize-none rounded-lg border border-white/15 bg-white/5 p-2.5 font-mono text-[11px] leading-relaxed outline-none placeholder:text-zinc-600 focus:border-white/30"
            />

            {scriptPreview.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10">
                {scriptPreview.map((scene, i) => (
                  <div key={i} className="flex gap-2 border-b border-white/5 px-2 py-1 text-[11px] last:border-0">
                    <span className="w-6 shrink-0 text-zinc-500">{i + 1}</span>
                    <span className={`w-10 shrink-0 tabular-nums ${scene.words < 30 || scene.words > 80 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {scene.words}w
                    </span>
                    <span className="min-w-0 flex-1 truncate text-zinc-300">{scene.narration}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">
                {scriptDraft.trim()
                  ? `${scriptPreview.length} scenes found`
                  : 'Nothing pasted yet'}
              </span>
              <button onClick={() => setScriptOpen(false)} className={`${ghost} ml-auto`}>
                Cancel
              </button>
              <button
                onClick={() => importScript('append')}
                disabled={!scriptPreview.length}
                className={ghost}
              >
                Add to board
              </button>
              <button
                onClick={() => importScript('replace')}
                disabled={!scriptPreview.length}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-40"
              >
                Replace all
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

const ghost =
  'rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs transition hover:bg-white/15 disabled:opacity-40'

function base64ToBlob(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'audio/mpeg' })
}
