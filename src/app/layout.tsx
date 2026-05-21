import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'M7 Tracker',
  description: '13-week study tracker · Operation M7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
