import Link from "next/link";

import { publicNotFoundContent } from "./not-found-content";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(43,108,150,0.1),transparent_55%),linear-gradient(180deg,#fcfaf6_0%,#f4f2ec_100%)] px-4 py-10">
      <section className="w-full max-w-md rounded-[28px] border border-border bg-card/95 p-7 text-center shadow-[0_28px_70px_-42px_rgba(41,37,36,0.75)] sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
          {publicNotFoundContent.eyebrow}
        </p>
        <p className="mt-5 text-6xl font-semibold text-ink-green" aria-hidden="true">
          404
        </p>
        <h1 className="mt-4 font-heading text-3xl font-semibold text-foreground">
          {publicNotFoundContent.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {publicNotFoundContent.description}
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            href={publicNotFoundContent.primaryAction.href}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {publicNotFoundContent.primaryAction.label}
          </Link>
          <Link
            href={publicNotFoundContent.secondaryAction.href}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {publicNotFoundContent.secondaryAction.label}
          </Link>
        </div>
      </section>
    </main>
  );
}
