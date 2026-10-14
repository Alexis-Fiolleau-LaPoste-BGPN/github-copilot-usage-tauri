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
        <footer className="mt-auto px-4 py-3 text-center text-xs text-fd-muted-foreground">
          Made with love <span aria-label="love">❤️</span> by{' '}
          <a
            href="https://github.com/Potowai"
            className="underline underline-offset-4 hover:text-fd-foreground"
          >
            @Potowai
          </a>
        </footer>
      </body>
    </html>
  );
}
