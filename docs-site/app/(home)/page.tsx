import Link from 'next/link';
import Image from 'next/image';

const RELEASES_URL = 'https://github.com/Potowai/github-copilot-tracker/releases/latest';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-10 px-6 py-16 text-center">
      <div className="flex max-w-2xl flex-col items-center gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-fd-muted-foreground">
          GCT
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          GitHub Copilot Tracker
        </h1>
        <p className="text-fd-muted-foreground">
          A lightweight Windows widget for GitHub Copilot AI-credit and Claude Code usage.
          Approximate currency estimates, English/French settings, and a compact always-on pill.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a
            href={RELEASES_URL}
            className="rounded-md bg-fd-primary px-4 py-2 text-sm font-semibold text-fd-primary-foreground"
          >
            Download the latest Windows release
          </a>
          <Link
            href="/docs"
            className="rounded-md border border-fd-border px-4 py-2 text-sm font-medium"
          >
            Read the docs
          </Link>
        </div>
      </div>

      <Image
        src={`${process.env.PAGES_BASE_PATH ?? ''}/widget-reference.png`}
        alt="Live screenshot of the GCT usage pill"
        width={637}
        height={291}
        className="rounded-lg border border-fd-border shadow-lg"
        priority
      />

      <p className="max-w-xl text-xs text-fd-muted-foreground">
        The pill shows GitHub Copilot AI credits or Claude Code usage. Currency estimates use
        GitHub&apos;s published $0.01-per-credit rate and a daily USD exchange rate; they are not
        billing amounts.
      </p>
    </div>
  );
}
