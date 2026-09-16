"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ShieldAlert, UtensilsCrossed } from "lucide-react";

import { BrandMark } from "@/shared/ui/brand-mark";
import { useBusinessSettings } from "@/shared/lib/business-settings";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";

export default function AdminLoginPage() {
  const router = useRouter();
  const settings = useBusinessSettings();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [checkingSession, setCheckingSession] = React.useState(true);

  React.useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/admin/session", {
          method: "GET",
          credentials: "same-origin",
        });
        if (res.ok) {
          router.replace("/admin");
        }
      } catch {
        // ignore
      } finally {
        setCheckingSession(false);
      }
    };
    void checkSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? "Credenciales inválidas. Intenta de nuevo.");
        return;
      }

      const sessionRes = await fetch("/api/auth/admin/session", {
        method: "GET",
        credentials: "same-origin",
      });

      if (!sessionRes.ok) {
        setError("No se pudo establecer la sesión. Intenta de nuevo.");
        return;
      }

      window.location.assign("/admin");
    } catch {
      setError("Error de red. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-line-subtle border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel de marca — solo desktop */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-surface-elevated via-brand-primary/20 to-canvas md:flex md:w-[42%] md:flex-col md:justify-between md:p-10 lg:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-amber/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-stitch-md bg-surface-card/40 text-ink ring-1 ring-line-strong">
            <UtensilsCrossed className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="font-heading text-st-h3 font-bold tracking-tight text-ink">
            {settings.name}
          </span>
        </div>

        <div className="relative space-y-4">
          <p className="text-st-overline font-bold uppercase tracking-wider text-ink-secondary">
            Admin operativo
          </p>
          <h2 className="font-heading text-st-display font-bold leading-tight text-ink">
            El pulso diario de tu restaurante, en un solo lugar.
          </h2>
          <p className="max-w-sm text-st-body leading-6 text-ink-secondary">
            Órdenes para llevar y menú, sin ruido operativo innecesario.
          </p>
        </div>

        <p className="relative text-st-caption text-ink-muted">
          © {new Date().getFullYear()} {settings.name}
        </p>
      </div>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center bg-canvas px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center md:text-left">
            <span className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-stitch-md bg-brand-primary text-st-body font-bold text-ink-inverse shadow-elevation-1 md:hidden">
              <BrandMark brand={settings} variant="full" className="h-11 w-11 rounded-stitch-md object-cover" fallbackClassName="flex h-11 w-11 items-center justify-center rounded-stitch-md bg-brand-primary text-st-body font-bold text-ink-inverse" />
            </span>
            <h1 className="font-heading text-st-h1 font-bold tracking-tight text-ink">
              Iniciar sesión
            </h1>
            <p className="text-st-body text-ink-secondary">Acceso administrativo de {settings.name}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-stitch-lg border border-line-subtle bg-surface-card p-6 shadow-elevation-1">
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-[2.35rem] h-4 w-4 text-ink-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
              <Input
                label="Correo electrónico"
                type="email"
                className="pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-[2.35rem] h-4 w-4 text-ink-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
              <Input
                label="Contraseña"
                type="password"
                className="pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-stitch-sm border border-status-sla-border bg-status-sla-bg p-3 text-st-body text-status-sla-text">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
