import type { Metadata, Viewport } from 'next';
import { display, ui } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Opportunity Tracker',
  description:
    'Internships, contract work, programs, and research — kept current by an agent.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Tracker' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f2ee' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d13' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
