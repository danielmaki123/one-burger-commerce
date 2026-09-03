"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { CartProvider, useCart } from "@/shared/lib/cart";
import { formatCurrency } from "@/shared/lib/format-currency";
import { PwaUpdateGate } from "@/shared/pwa/pwa-update-gate";
import { Badge } from "@/shared/ui/badge";
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
          aria-label="One Burger inicio"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-foreground md:h-10 md:w-10">
            OB
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span
              className="truncate text-base font-semibold tracking-[-0.01em] md:text-xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              One Burger
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
            {formatCurrency(subtotal)}
          </span>
        </div>
      </Link>
    </div>
  );
}

function Footer() {
  return (
    <footer className={getPublicFooterClassName()}>
      <div className="mx-auto max-w-6xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-3 md:px-6 md:py-10">
        <div className={getPublicMobileInfoFooterClassName()}>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <a href="tel:+50588770888" className="font-semibold text-foreground">
              WhatsApp
            </a>
            <span aria-hidden="true">·</span>
            <span>Lun - Dom 12:00 - 22:00</span>
            <span aria-hidden="true">·</span>
            <span>Jinotepe</span>
          </div>
        </div>

        <div className="hidden gap-8 md:grid md:grid-cols-3">
          <div>
            <p
              className="text-lg font-semibold text-ink-green"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              One Burger
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Burgers y pedidos para llevar.
            </p>
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
              href="tel:+50588770888"
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
              <p>+505 8877 0888</p>
              <p>@oneburger</p>
              <p>Lun - Dom, 12:00 - 22:00</p>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          One Burger - pedidos para llevar
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
