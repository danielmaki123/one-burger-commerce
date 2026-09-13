"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { CartProvider, useCart } from "@/shared/lib/cart";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import type { PublicLocation } from "@/modules/locations/features/list-public-locations/list-public-locations";
import { BrandMark } from "@/shared/ui/brand-mark";
import { formatPhoneForDisplay } from "@/modules/business-settings/domain/format-phone";
import { formatCurrency } from "@/shared/lib/format-currency";
import { PwaUpdateGate } from "@/shared/pwa/pwa-update-gate";
import { Badge } from "@/shared/ui/badge";
import { PublicLocationsList } from "@/shared/ui/public-locations-list";
import { PublicMobileBottomNav } from "@/shared/ui/public-mobile-bottom-nav";

import { OrderTrackingSessionProvider } from "./_components/order-tracking-session";
import {
  getPublicFooterClassName,
  getPublicHeaderClassName,
  getPublicMobileInfoFooterClassName,
  shouldRenderPublicMobileBottomNav,
} from "./public-layout-helpers";

function Header() {
  const { items } = useCart();
  const settings = useBusinessSettings();
  const pathname = usePathname();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const navLink = (href: string, label: string) => {
    const isActive =
      pathname === href || (href !== "/" && pathname.startsWith(href));

    return (
      <Link
        href={href}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          isActive ? "text-brand" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className={getPublicHeaderClassName()}>
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-3 md:h-16 md:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 text-ink-green md:gap-3"
          aria-label={`${settings.name} inicio`}
        >
          <BrandMark brand={settings} />
          <span className="flex min-w-0 flex-col leading-none">
            <span
              className="truncate text-base font-semibold tracking-[-0.01em] md:text-xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {settings.name}
            </span>
            <span className="mt-1 hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              Pickup
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 sm:flex sm:gap-3">
            {navLink("/menu", "Menú")}
            <Link
              href="/cart"
              aria-label="Carrito"
              className="relative rounded-full p-2 transition-colors hover:bg-cream"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-foreground"
              >
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              {itemCount > 0 ? (
                <Badge
                  variant="default"
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]"
                >
                  {itemCount}
                </Badge>
              ) : null}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function CartStickyBar() {
  const { items, subtotal } = useCart();
  const currency = useCurrencyFormat();
  const pathname = usePathname();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const isProductDetailRoute = /^\/menu\/[^/]+$/.test(pathname);
  const hideOnCurrentRoute =
    pathname === "/cart" || pathname === "/checkout" || isProductDetailRoute;

  if (itemCount === 0 || hideOnCurrentRoute) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 hidden w-full max-w-md -translate-x-1/2 px-4 md:block">
      <Link href="/cart">
        <div className="flex h-14 items-center justify-between rounded-xl bg-brand px-6 text-brand-foreground shadow-lg transition-transform active:scale-95">
          <span className="text-sm font-medium uppercase tracking-wider">
            Ver carrito
          </span>
          <span className="text-lg font-semibold">
            {formatCurrency(subtotal, currency)}
          </span>
        </div>
      </Link>
    </div>
  );
}

function Footer() {
  const settings = useBusinessSettings();
  const phoneDisplay = formatPhoneForDisplay(settings.phone);
  const contactHref = settings.phone ? `tel:${settings.phone}` : "/menu";
  const [locations, setLocations] = React.useState<PublicLocation[]>([]);

  /**
   * A-07: la información de **cada sucursal**, de `GET /api/locations` (solo activos y ya
   * ordenados), en vez del horario y la ciudad de la configuración del negocio. Si la lectura
   * falla o no hay locales, el footer queda con el contacto del negocio: el respaldo es la
   * configuración.
   *
   * El horario del negocio **no** se dibuja en ninguna parte del footer (decisión del owner,
   * 2026-09-12): con más de un local no corresponde a ninguno, y el de cada sucursal está en la
   * lista de arriba. Antes se imprimía acá y en el bloque oculto de móvil.
   */
  React.useEffect(() => {
    async function fetchLocations() {
      try {
        const res = await fetch("/api/locations", { cache: "no-store" });
        if (!res.ok) return;

        const payload = (await res.json()) as { data?: PublicLocation[] };
        setLocations(payload.data ?? []);
      } catch {
        // Sin sucursales se muestra el contacto del negocio: no se avisa de nada.
      }
    }

    void fetchLocations();
  }, []);

  return (
    <footer className={getPublicFooterClassName()}>
      <div className="mx-auto max-w-6xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-3 md:px-6 md:py-10">
        <div className={getPublicMobileInfoFooterClassName()}>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <a href={contactHref} className="font-semibold text-foreground">
              WhatsApp
            </a>
          </div>
        </div>

        {locations.length > 0 ? (
          <div className="mb-8">
            {/* Un solo encabezado real (no un rótulo + un heading oculto con el mismo texto):
                el tamaño lo fija `text-xs` en la clase y el `h2` lo aporta la etiqueta. */}
            <h2 className="text-xs font-semibold uppercase tracking-wider text-brand">
              Sucursales
            </h2>
            <PublicLocationsList
              locations={locations}
              variant="compact"
              className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            />
          </div>
        ) : null}

        <div className="hidden gap-8 md:grid md:grid-cols-3">
          <div>
            <p
              className="text-lg font-semibold text-ink-green"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {settings.name}
            </p>
            {settings.tagline ? (
              <p className="mt-2 text-sm text-muted-foreground">{settings.tagline}</p>
            ) : null}
          </div>

          <nav className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">
              Explorar
            </p>
            <Link
              href="/menu"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Menú
            </Link>
            <Link
              href={contactHref}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Contacto
            </Link>
          </nav>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">
              Contacto
            </p>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {phoneDisplay ? <p>{phoneDisplay}</p> : null}
              {settings.instagram ? <p>@{settings.instagram}</p> : null}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          {settings.name}
          {settings.tagline ? ` - ${settings.tagline}` : ""}
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const renderMobileBottomNav = shouldRenderPublicMobileBottomNav(pathname);

  return (
    <CartProvider>
      <OrderTrackingSessionProvider>
        <div className="flex min-h-screen flex-col font-sans text-foreground">
          <Header />
          <main
            className={`flex-1 ${
              renderMobileBottomNav
                ? "pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-20"
                : "pb-12 md:pb-20"
            }`}
          >
            {children}
          </main>
          {isHome ? null : <Footer />}
          {renderMobileBottomNav ? <PublicMobileBottomNav /> : null}
          <CartStickyBar />
          <PwaUpdateGate />
        </div>
      </OrderTrackingSessionProvider>
    </CartProvider>
  );
}
