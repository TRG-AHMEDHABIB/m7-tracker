import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Operation M7 — GRE Tracker',
  description: '13-week prep · May 25 → Aug 22, 2026 · Target 328',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
