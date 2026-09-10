import * as React from "react";

import { Badge } from "@/shared/ui/badge";

type PublicConfirmationShellProps = {
  badgeLabel: string;
  badgeVariant?: "warning" | "success" | "secondary";
  title: string;
  description: string;
  primaryAction: React.ReactNode;
  secondaryAction?: React.ReactNode;
  children: React.ReactNode;
};

export function PublicConfirmationShell({
  badgeLabel,
  badgeVariant = "warning",
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
}: PublicConfirmationShellProps) {
  return (
    <div className="min-h-screen brand-canvas">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-28 pt-6 sm:px-6 sm:pb-16 sm:pt-8">
        <section className="overflow-hidden rounded-[32px] border border-stone-200/80 brand-surface shadow-[0_30px_80px_-52px_rgba(41,37,36,0.55)]">
          <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
            <div className="space-y-5">
              <Badge
                variant={badgeVariant}
                className="w-fit px-3 py-1.5 text-[11px] uppercase tracking-[0.24em]"
              >
                {badgeLabel}
              </Badge>
              <div className="space-y-3">
                <h1
                  className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {title}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
                  {description}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                {primaryAction}
                {secondaryAction}
              </div>
            </div>

            <div className="mx-auto flex w-full max-w-[190px] items-end justify-center md:mx-0 md:ml-auto md:max-w-[220px]">
              <span className="flex aspect-square w-full max-w-[156px] items-center justify-center rounded-[32px] bg-brand text-4xl font-bold text-brand-foreground shadow-[0_18px_26px_rgba(31,111,69,0.16)]">
                OB
              </span>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-stone-200 bg-white/95 p-5 shadow-[0_20px_60px_-48px_rgba(41,37,36,0.45)] sm:p-6">
          {children}
        </section>
      </div>
    </div>
  );
}
