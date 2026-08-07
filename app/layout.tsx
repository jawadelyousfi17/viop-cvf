import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, Martian_Mono, Patrick_Hand } from "next/font/google";
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
  title: "viop — an AI teacher at the whiteboard",
  description:
    "Name a topic and watch it explained on an infinite whiteboard, drawn and narrated as it goes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${hand.variable} ${fraunces.variable} ${martian.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
