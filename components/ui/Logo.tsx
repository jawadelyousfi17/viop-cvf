import Image from 'next/image'
import Link from 'next/link'
import mark from '@/public/logo.png'

/**
 * The wordmark.
 *
 * One component rather than an `<Image>` pasted into six headers, because a
 * logo is the thing most likely to be replaced and least likely to be replaced
 * everywhere. It also carries the two decisions that are easy to get wrong per
 * copy: the alt text is the company name once — a link that reads "Nipsole
 * Nipsole" to a screen reader is what you get when the image keeps its alt
 * beside a text label — and the height is fixed while the width follows the
 * source ratio, so it cannot be squashed by whatever box it lands in.
 *
 * Imported statically rather than by path, so Next reads the real dimensions at
 * build time and reserves the space. A `/logo.png` string would leave the
 * header a few pixels short until the file lands and then push everything down.
 */
export function Logo({
  height = 28,
  href = '/',
  className = '',
  priority = false,
}: {
  /** Rendered height in pixels. Width follows the 4:1 source. */
  height?: number
  /** Where it links. `null` for the places that are already there. */
  href?: string | null
  className?: string
  /** Set on the one in the first screenful, so it is not lazy-loaded. */
  priority?: boolean
}) {
  const image = (
    <Image
      src={mark}
      alt="Nipsole"
      height={height}
      width={height * (mark.width / mark.height)}
      priority={priority}
      className={`w-auto ${className}`}
      style={{ height }}
    />
  )

  if (!href) return image

  return (
    <Link href={href} className="inline-flex shrink-0 items-center transition hover:opacity-80">
      {image}
    </Link>
  )
}
