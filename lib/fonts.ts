import { Instrument_Serif, Manrope } from 'next/font/google';

/**
 * Two faces, two jobs.
 *
 * Instrument Serif carries the human moments — the greeting, the headline
 * numbers. It has real contrast and a slightly literary quality, which is what
 * keeps a dashboard from reading like a database viewer.
 *
 * Manrope handles everything operational. Geometric, even color, and its
 * numerals line up cleanly in tabular columns, which matters more here than
 * personality does.
 *
 * Both are self-hosted by next/font at build time — no external requests, so
 * the strict CSP holds and there's no flash of fallback text.
 */

export const display = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const ui = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui',
});
