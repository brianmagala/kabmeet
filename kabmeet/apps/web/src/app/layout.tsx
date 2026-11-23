import type { Metadata } from 'next';
import { Oswald, Poppins } from 'next/font/google';
import '@/app/globals.css';
import { AppShell, Providers } from '@/components/layout';

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kabmeet — KAB AI / IndabaX Live Sessions',
  description:
    'Live sessions, private virtual classes, and shared developer workspaces for Kabale University (ai.kab.ac.ug/indabax).',
  openGraph: {
    title: 'Kabmeet — KAB AI / IndabaX Live Sessions',
    description:
      'Live sessions, private virtual classes, and shared developer workspaces for Kabale University.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${oswald.variable} ${poppins.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
