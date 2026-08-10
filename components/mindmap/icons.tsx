/**
 * The interface's icons, drawn here rather than fetched.
 *
 * A stylesheet from a CDN is a render-blocking request to someone else's
 * server, a second font to download, and a hole in the content-security policy
 * — for a dozen glyphs of which this app uses about fifteen. These are inline
 * SVG: no request, no flash of missing icons, and they take the text colour
 * around them like any other letterform.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Icon({ children, className = 'size-4' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} {...stroke}>
      {children}
    </svg>
  )
}

export function IconSearch({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="9" cy="9" r="5.2" />
      <path d="m13 13 3.4 3.4" />
    </Icon>
  )
}

export function IconHome({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M3.5 9 10 3.8 16.5 9v6.7a.8.8 0 0 1-.8.8h-3.4v-4.3H7.7v4.3H4.3a.8.8 0 0 1-.8-.8Z" />
    </Icon>
  )
}

/** A root with branches — the product, in one glyph. */
export function IconMap({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="4.6" cy="10" r="2" />
      <circle cx="15.4" cy="5.4" r="1.8" />
      <circle cx="15.4" cy="14.6" r="1.8" />
      <path d="M6.6 10h2.6c1.2 0 1.6-.5 2.2-1.4l.9-1.4c.4-.6.8-.8 1.5-.8" />
      <path d="M6.6 10h2.6c1.2 0 1.6.5 2.2 1.4l.9 1.4c.4.6.8.8 1.5.8" />
    </Icon>
  )
}

export function IconBoard({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="3.2" y="4" width="13.6" height="9.6" rx="1.6" />
      <path d="M10 13.6v2.6M7.4 16.2h5.2" />
    </Icon>
  )
}

export function IconTag({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M10.4 3.6H4.4a.8.8 0 0 0-.8.8v6l6.6 6.6a.9.9 0 0 0 1.3 0l4.5-4.5a.9.9 0 0 0 0-1.3Z" />
      <circle cx="7.2" cy="7.2" r="1" />
    </Icon>
  )
}

export function IconPlus({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M10 4.6v10.8M4.6 10h10.8" />
    </Icon>
  )
}

export function IconChevron({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m6.5 8.2 3.5 3.6 3.5-3.6" />
    </Icon>
  )
}

export function IconBell({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M5.6 8.4a4.4 4.4 0 0 1 8.8 0c0 3 .8 4.2 1.3 4.8H4.3c.5-.6 1.3-1.8 1.3-4.8Z" />
      <path d="M8.4 15.6a1.8 1.8 0 0 0 3.2 0" />
    </Icon>
  )
}

export function IconShare({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M10 13V4.4M6.9 7.2 10 4.1l3.1 3.1" />
      <path d="M4.6 12v3.2a.8.8 0 0 0 .8.8h9.2a.8.8 0 0 0 .8-.8V12" />
    </Icon>
  )
}

export function IconArrowUp({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M10 15.4V5.2M5.8 9.2 10 5l4.2 4.2" />
    </Icon>
  )
}

export function IconSparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className ?? 'size-4'} fill="currentColor">
      <path d="M10 2.6c.5 3.3 1.5 4.3 4.8 4.8-3.3.5-4.3 1.5-4.8 4.8-.5-3.3-1.5-4.3-4.8-4.8 3.3-.5 4.3-1.5 4.8-4.8Z" />
      <path d="M15.2 12.4c.3 1.7.8 2.2 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.3 2.2-.8 2.5-2.5Z" />
    </svg>
  )
}

export function IconTrash({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4.8 6.2h10.4M8.2 6.2V4.8h3.6v1.4M6.4 6.2l.6 8.6a.8.8 0 0 0 .8.8h4.4a.8.8 0 0 0 .8-.8l.6-8.6" />
    </Icon>
  )
}

export function IconFold({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M7 4.4 10 7.4l3-3M13 15.6 10 12.6l-3 3" />
      <path d="M4 10h12" />
    </Icon>
  )
}

export function IconClose({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m5.6 5.6 8.8 8.8M14.4 5.6l-8.8 8.8" />
    </Icon>
  )
}

/** The tip button: a hint, not an error, so a lamp rather than a question mark. */
export function IconHint({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M7.6 13.4a4.6 4.6 0 1 1 4.8 0v1.4H7.6Z" />
      <path d="M8.4 16.8h3.2" />
    </Icon>
  )
}

/** Centre the map on its root again. */
export function IconTarget({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="10" cy="10" r="5.6" />
      <circle cx="10" cy="10" r="1.6" />
      <path d="M10 1.8v2.2M10 16v2.2M1.8 10H4M16 10h2.2" />
    </Icon>
  )
}

export function IconFit({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 7.4V4.6a.6.6 0 0 1 .6-.6h2.8M12.6 4h2.8a.6.6 0 0 1 .6.6v2.8M16 12.6v2.8a.6.6 0 0 1-.6.6h-2.8M7.4 16H4.6a.6.6 0 0 1-.6-.6v-2.8" />
    </Icon>
  )
}

/** Voice input. Drawn now, wired up later. */
export function IconMic({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="7.6" y="2.8" width="4.8" height="9" rx="2.4" />
      <path d="M4.8 9.4a5.2 5.2 0 0 0 10.4 0" />
      <path d="M10 14.6v2.6M7.4 17.2h5.2" />
    </Icon>
  )
}

/** The maths tutor: a summation sign, drawn rather than set in a font. */
export function IconSigma({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M14.4 4.6H5.6l4.2 5.4-4.2 5.4h8.8" />
    </Icon>
  )
}
