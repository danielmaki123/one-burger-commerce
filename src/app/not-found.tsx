import Link from "next/link";

import { getPublicBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { publicNotFoundContentFor } from "./not-found-content";

export default async function NotFound() {
  const settings = await getPublicBusinessSettings();
  const content = publicNotFoundContentFor(settings.name);

  return (
    <main className="brand-canvas flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-[28px] border border-border bg-card/95 p-7 text-center shadow-[0_28px_70px_-42px_rgba(41,37,36,0.75)] sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
          {content.eyebrow}
        </p>
        <p className="mt-5 text-6xl font-semibold text-ink-green" aria-hidden="true">
          404
        </p>
        <h1 className="mt-4 font-heading text-3xl font-semibold text-foreground">
          {content.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {content.description}
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            href={content.primaryAction.href}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {content.primaryAction.label}
          </Link>
          <Link
            href={content.secondaryAction.href}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {content.secondaryAction.label}
          </Link>
        </div>
      </section>
    </main>
  );
}
