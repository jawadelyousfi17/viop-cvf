import type { Metadata } from "next";
import {
  Fraunces,
  Geist,
  Geist_Mono,
  JetBrains_Mono,
  Martian_Mono,
  Patrick_Hand,
} from "next/font/google";
import "./globals.css";

/**
 * The demo's two voices.
 *
 * Fraunces carries the titles — a serif with a wonk axis and real optical
 * sizing, so a plate heading at 76px has character a screen font does not.
 * Martian Mono is the technical layer: annotations, part numbers, code. The
 * contrast between them *is* the design, which is why there are two and not
 * five.
 */
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const martian = Martian_Mono({
  variable: "--font-technical",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The face code is written in.
 *
 * JetBrains Mono rather than the UI mono, because the course editor is the one
 * place on the site where someone reads code for minutes at a time rather than
 * glancing at a label. Its tall x-height and unambiguous 1/l/I and 0/O are what
 * that job actually needs — and a beginner who cannot tell a one from an ell is
 * debugging the typeface, not the language.
 */
const jetbrains = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

/**
 * The hand the Slate board is written in.
 *
 * Self-hosted by next/font rather than fetched at runtime, so the board does
 * not flash in a system face and then reflow — a board whose shapes are sized
 * to the text has to know the text's real width before it draws its borders.
 *
 * One weight, on purpose. Hierarchy on a whiteboard comes from size, the way it
 * does on a real one; a bold hand-drawn face reads as a different pen.
 */
const hand = Patrick_Hand({
  variable: "--font-hand",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "nipsol — an AI teacher at the whiteboard",
  description:
    "Name a topic and watch it explained on an infinite whiteboard, drawn and narrated as it goes.",
  // Proves to Google Search Console that whoever set this up owns the domain.
  // Written through `verification` rather than as a hand-written <meta> so it
  // goes in the head Next builds, and stays there if this file ever stops
  // rendering its own <head>.
  verification: {
    google: "MhUYosBn4YlA1ZjcNy090Tv907xLA3t3B8TXDsf8vms",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${jetbrains.variable} ${hand.variable} ${fraunces.variable} ${martian.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
