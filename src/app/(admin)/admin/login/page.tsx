"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ShieldAlert, UtensilsCrossed } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";

export default function AdminLoginPage() {
  const router = useRouter();
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-brand" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel de marca — solo desktop */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-ink-green via-brand-strong to-brand md:flex md:w-[42%] md:flex-col md:justify-between md:p-10 lg:p-14">
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
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-card/10 text-white ring-1 ring-white/25">
            <UtensilsCrossed className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="font-heading text-xl font-bold tracking-tight text-white">
            One Burger
          </span>
        </div>

        <div className="relative space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            Admin operativo
          </p>
          <h2 className="font-heading text-3xl font-bold leading-tight text-white lg:text-4xl">
            El pulso diario de tu restaurante, en un solo lugar.
          </h2>
          <p className="max-w-sm text-sm leading-6 text-white/70">
            Órdenes para llevar y menú, sin ruido operativo innecesario.
          </p>
        </div>

        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} One Burger
        </p>
      </div>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center md:text-left">
            <span className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-foreground shadow-sm md:hidden">
              OB
            </span>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Iniciar sesión
            </h1>
            <p className="text-sm text-muted-foreground">Acceso administrativo de One Burger</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-[2.35rem] h-4 w-4 text-muted-foreground"
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
                className="pointer-events-none absolute left-3 top-[2.35rem] h-4 w-4 text-muted-foreground"
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
              <div className="flex items-start gap-2 rounded-md border border-danger-strong/30 bg-danger p-3 text-sm text-danger-foreground">
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
