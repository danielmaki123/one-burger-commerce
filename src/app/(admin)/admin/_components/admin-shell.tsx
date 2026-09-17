"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { canUsePOS } from "@/modules/auth/domain/admin-permissions";
import { isAdminRole } from "@/modules/auth/domain/admin-role";
import { BrandMark } from "@/shared/ui/brand-mark";
import { useBusinessSettings } from "@/shared/lib/business-settings";

import {
  ADMIN_SECONDARY_NAV_ITEMS,
  getAdminNavGroups,
  getAdminNavIconClassName,
  getAdminNavLinkClassName,
  isAdminNavItemActive,
} from "../admin-layout-helpers";
import AdminMobileNav from "./admin-mobile-nav";
import AdminSessionControls, {
  type AdminSessionState,
} from "./admin-session-controls";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const settings = useBusinessSettings();
  const isLoginRoute = pathname === "/admin/login";
  const [session, setSession] = React.useState<AdminSessionState>({
    status: "loading",
  });

  React.useEffect(() => {
    if (isLoginRoute) {
      setSession({ status: "loading" });
      return;
    }

    let isCurrent = true;

    const loadRole = async () => {
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
          data?: {
            user?: { name?: string; email?: string; role?: string };
          };
        };
        const user = payload.data?.user;
        if (isCurrent && user?.role && isAdminRole(user.role)) {
          setSession({
            status: "authenticated",
            user: {
              name: user.name ?? "Admin",
              email: user.email ?? "",
              role: user.role,
            },
          });
        } else if (isCurrent) {
          setSession({ status: "unauthenticated" });
        }
      } catch {
        if (isCurrent) setSession({ status: "unauthenticated" });
      }
    };

    void loadRole();
    return () => {
      isCurrent = false;
    };
  }, [isLoginRoute]);

  const role = session.status === "authenticated" ? session.user.role : undefined;
  // TASK-308: la caja depende del local, no del rol. Se pregunta una sola vez y, mientras no se
  // sepa, la entrada no se ofrece: la navegación no inventa un permiso que el servidor va a negar.
  const canUsePos = role ? canUsePOS(role) : false;
  const [posAvailable, setPosAvailable] = React.useState(false);

  React.useEffect(() => {
    if (!canUsePos) {
      setPosAvailable(false);
      return;
    }

    let isCurrent = true;

    const loadPosAvailability = async () => {
      try {
        const response = await fetch("/api/admin/pos/availability", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = (await response.json()) as { data?: { available?: boolean } };
        if (isCurrent) setPosAvailable(payload.data?.available === true);
      } catch {
        // Sin respuesta no hay mostrador que ofrecer: el POS sigue entrando por URL.
      }
    };

    void loadPosAvailability();
    return () => {
      isCurrent = false;
    };
  }, [canUsePos]);

  const navGroups = React.useMemo(
    () => getAdminNavGroups(role, { posAvailable }),
    [role, posAvailable],
  );
  const homeHref = role === "owner" ? "/admin" : "/admin/orders";

  if (isLoginRoute) {
    // El panel es oscuro (sistema Stitch): `dark` acá activa los tokens del modo oscuro para todo
    // el subárbol del admin, sin tocar el sitio público, que sigue claro (decisión C3 del owner).
    return <div className="dark min-h-screen bg-canvas text-ink">{children}</div>;
  }

  return (
    <div className="dark flex min-h-screen bg-canvas text-ink">
      <AdminMobileNav pathname={pathname} groups={navGroups} session={session} />

      <aside data-admin-background className="admin-sidebar-shell hidden md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-line-subtle md:bg-surface-card/95 md:backdrop-blur">
        <div className="flex flex-col items-start gap-3 px-5 py-5">
          <Link
            href={homeHref}
            className="flex min-h-11 items-center gap-3 rounded-stitch-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <BrandMark
              brand={settings}
              className="h-10 w-10 shrink-0 rounded-stitch-md object-cover shadow-elevation-1"
              fallbackClassName="flex h-10 w-10 shrink-0 items-center justify-center rounded-stitch-md bg-brand text-st-body font-bold text-ink-inverse shadow-elevation-1"
            />
            <span className="min-w-0">
              <span className="block font-heading text-st-body-lg font-bold tracking-tight text-ink">
                {settings.name}
              </span>
              <span className="block text-st-caption font-medium text-ink-secondary">
                Admin operativo
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex flex-1 overflow-y-auto px-4 pb-5" aria-label="Navegación principal">
          <div className="flex flex-col gap-5">
            {navGroups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1.5">
                <p className="px-2 text-st-overline font-bold uppercase tracking-wider text-ink-muted">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const isActive = isAdminNavItemActive(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-admin-desktop-nav-link
                      aria-current={isActive ? "page" : undefined}
                      className={getAdminNavLinkClassName(isActive)}
                    >
                      <Icon className={getAdminNavIconClassName(isActive)} strokeWidth={2} aria-hidden="true" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span>{item.label}</span>
                        <span
                          className={`text-st-caption font-normal ${
                            isActive
                              ? "text-ink-inverse/80"
                              : "text-ink-secondary group-hover:text-brand-primary"
                          }`}
                        >
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}

            {ADMIN_SECONDARY_NAV_ITEMS.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="px-2 text-st-overline font-bold uppercase tracking-wider text-ink-muted">
                  Avanzado
                </p>
                {ADMIN_SECONDARY_NAV_ITEMS.map((item) => {
                const isActive = isAdminNavItemActive(pathname, item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-admin-desktop-nav-link
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "group inline-flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-stitch-md px-3 py-2 text-left text-st-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary motion-reduce:transition-none",
                      isActive
                        ? "bg-brand-primary-muted text-brand-primary"
                        : "bg-surface-card text-ink hover:bg-surface-elevated hover:text-brand-primary",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="border-t border-line-subtle p-4">
          <AdminSessionControls session={session} />
        </div>
      </aside>

      <main
        data-admin-background
        data-admin-main-focus-target
        tabIndex={-1}
        className="min-w-0 flex-1 px-3 py-4 pb-24 focus:outline-none sm:px-4 md:px-7 md:py-7 md:pb-7"
      >
        <div data-admin-main-inner className="mx-auto w-full min-w-0 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
