"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, type ReactNode } from "react";

const SHEET_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getSheetFocusableElements(sheet: HTMLElement): HTMLElement[] {
  return Array.from(
    sheet.querySelectorAll<HTMLElement>(SHEET_FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.hidden && element.getAttribute("aria-hidden") !== "true",
  );
}

type AdminEditSheetProps = {
  open: boolean;
  onClose: () => void;
  kicker?: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Hoja de edición del admin v2: bottom sheet en móvil, diálogo centrado en
 * desktop. Mismo contrato de accesibilidad que la hoja "Más" del nav:
 * focus trap, Escape, fondo inert, retorno de foco al disparador.
 */
export default function AdminEditSheet({
  open,
  onClose,
  kicker,
  title,
  children,
  footer,
}: AdminEditSheetProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    const backgrounds = Array.from(
      document.querySelectorAll<HTMLElement>("[data-admin-background]"),
    );
    const previousBackgroundState = backgrounds.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));

    document.body.style.overflow = "hidden";
    for (const element of backgrounds) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key === "Tab") {
        const sheet = sheetRef.current;
        if (!sheet) return;

        const focusableElements = getSheetFocusableElements(sheet);
        if (focusableElements.length === 0) {
          event.preventDefault();
          sheet.focus();
          return;
        }

        const currentIndex = focusableElements.findIndex(
          (element) => element === document.activeElement,
        );
        const lastIndex = focusableElements.length - 1;

        if (event.shiftKey && currentIndex <= 0) {
          event.preventDefault();
          focusableElements[lastIndex]?.focus();
        } else if (!event.shiftKey && (currentIndex === -1 || currentIndex === lastIndex)) {
          event.preventDefault();
          focusableElements[0]?.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const animationFrame = window.requestAnimationFrame(() => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const firstFocusableElement = getSheetFocusableElements(sheet)[0];
      if (firstFocusableElement) {
        firstFocusableElement.focus();
      } else {
        sheet.focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.body.style.overflow = previousOverflow;
      for (const previous of previousBackgroundState) {
        previous.element.inert = previous.inert;
        if (previous.ariaHidden === null) {
          previous.element.removeAttribute("aria-hidden");
        } else {
          previous.element.setAttribute("aria-hidden", previous.ariaHidden);
        }
      }
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Cerrar edición"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-coal/45 backdrop-blur-[1px] motion-reduce:backdrop-blur-none"
      />
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-border bg-card shadow-2xl focus:outline-none sm:max-h-[85vh] sm:max-w-lg sm:rounded-3xl sm:border"
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border sm:hidden" />
        <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
          <div className="min-w-0">
            {kicker ? (
              <p className="text-[11px] font-semibold uppercase tracking-widest text-brand">
                {kicker}
              </p>
            ) : null}
            <h2 className="mt-0.5 truncate font-heading text-xl font-bold tracking-tight text-foreground">
              {title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar edición"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border px-5 py-4">
          {children}
        </div>

        {footer ? (
          <footer className="shrink-0 border-t border-border bg-card px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
