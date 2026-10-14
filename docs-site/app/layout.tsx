import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Provider } from '@/components/provider';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://potowai.github.io/github-copilot-tracker/'),
  title: {
    default: 'GCT — GitHub Copilot Tracker',
    template: '%s | GCT',
  },
  description:
    'A lightweight Windows widget for GitHub Copilot AI-credit and Claude Code usage.',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
