import type { Metadata } from 'next';
import './globals.css';
import './dashboard.css';
import './setup.css';

export const metadata: Metadata = {
  title: 'Recast — Casting continuity & availability studio',
  description: 'Recast a role without breaking shooting continuity, union hours, or double-booked talent.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="pact-app-layout antialiased font-sans bg-paper-base text-ink-primary">
        {children}
      </body>
    </html>
  );
}
