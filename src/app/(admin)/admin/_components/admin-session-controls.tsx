"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { Button } from "@/shared/ui/button";

export type AdminSessionState =
  | { status: "loading" }
  | {
      status: "authenticated";
      user: { name: string; email: string; role: AdminRole };
    }
  | { status: "unauthenticated" };

export default function AdminSessionControls({
  session,
}: {
  session: AdminSessionState;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/admin/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  };

  if (session.status === "loading") {
    return (
      <div className="flex h-8 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-line-subtle border-t-brand" />
      </div>
    );
  }

  if (session.status === "authenticated") {
    const initial = session.user.name.trim().charAt(0).toUpperCase() || "A";

    return (
      <div className="flex min-w-0 items-center gap-3 md:w-full md:flex-col md:items-stretch md:gap-2">
        <div className="flex min-w-0 items-center gap-2.5 rounded-stitch-md bg-surface-low px-3 py-2 text-left md:w-full">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-st-caption font-bold text-ink-inverse">
            {initial}
          </span>
          <span className="hidden min-w-0 md:block">
            <p className="truncate text-st-caption font-semibold text-ink">{session.user.name}</p>
            <p className="truncate text-st-overline text-ink-secondary">{session.user.email}</p>
          </span>
        </div>
        <Button variant="outline" size="sm" className="min-h-11 md:w-full" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? "Saliendo..." : "Cerrar sesión"}
        </Button>
      </div>
    );
  }

  return (
    <Link
      href="/admin/login"
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-line-subtle bg-transparent px-3 text-st-caption font-medium text-ink transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none md:w-full"
    >
      Iniciar sesión
    </Link>
  );
}
