"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, PanelLeft } from "lucide-react";

import { isAdminRole, type AdminRole } from "@/modules/auth/domain/admin-role";
import { canViewAdminOverview } from "@/modules/auth/domain/admin-permissions";
import { Button } from "@/shared/ui/button";

type Session =
  | { status: "loading" }
  | { status: "authenticated"; user: { name: string; email: string; role: AdminRole } }
  | { status: "unauthenticated" };

/**
 * B6 — la salida de la vista de comandas.
 *
 * Esta vista esconde la barra lateral del panel, y con ella el bloque de sesión: sin esto, quien
 * entrara con una cuenta de cocina quedaba **sin forma de cerrar sesión**. Y el enlace «Volver al
 * panel» apuntaba a `/admin`, que para cualquier rol que no sea el dueño no existe: la pantalla lo
 * devolvía a la misma vista de comandas, en círculos. Las dos cosas se arreglan acá:
 *
 * - la barra dice **quién está** en la pantalla (en una tablet compartida, importa);
 * - ofrece **Cerrar sesión** siempre;
 * - solo ofrece «Volver al panel» a quien puede abrirlo, con la misma regla que usa `/admin` para
 *   decidir si redirige (`canViewAdminOverview`), así que no puede volver a quedar desincronizada.
 *
 * La sesión se pide acá en vez de recibirla por prop porque el shell del panel no se la pasa a las
 * páginas: es una lectura de una ruta propia, con la misma forma que la que ya hace el shell.
 */
export function ComandaSessionBar() {
  const router = useRouter();
  const [session, setSession] = useState<Session>({ status: "loading" });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/admin/session", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) {
          if (isCurrent) setSession({ status: "unauthenticated" });
          return;
        }

        const payload = (await response.json()) as {
          data?: { user?: { name?: string; email?: string; role?: string } };
        };
        const user = payload.data?.user;

        if (isCurrent && user?.role && isAdminRole(user.role)) {
          setSession({
            status: "authenticated",
            user: { name: user.name ?? "Admin", email: user.email ?? "", role: user.role },
          });
        } else if (isCurrent) {
          setSession({ status: "unauthenticated" });
        }
      } catch {
        if (isCurrent) setSession({ status: "unauthenticated" });
      }
    }

    void loadSession();

    return () => {
      isCurrent = false;
    };
  }, []);

  async function logout() {
    setLoggingOut(true);

    try {
      await fetch("/api/auth/admin/logout", { method: "POST" });
    } catch {
      // Aunque falle la llamada se sale igual a la pantalla de login: quedarse acá encerrado es peor.
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  }

  if (session.status !== "authenticated") return null;

  const { user } = session;

  return (
    <span className="flex flex-wrap items-center gap-2" data-testid="comandas-session">
      {canViewAdminOverview(user.role) ? (
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none"
        >
          <PanelLeft aria-hidden="true" className="h-4 w-4" />
          Volver al panel
        </Link>
      ) : null}

      <span className="min-w-0 text-xs font-semibold text-foreground">
        <span className="block truncate">
          {user.name}
          <span className="ml-1 font-normal text-muted-foreground">({user.role})</span>
        </span>
        {/* El correo es lo que saca la duda cuando dos personas comparten nombre en la misma tablet. */}
        {user.email ? (
          <span className="block truncate text-[10px] font-normal text-muted-foreground">
            {user.email}
          </span>
        ) : null}
      </span>

      <Button
        variant="outline"
        className="min-h-11 gap-2"
        disabled={loggingOut}
        onClick={() => void logout()}
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {loggingOut ? "Saliendo…" : "Cerrar sesión"}
      </Button>
    </span>
  );
}
