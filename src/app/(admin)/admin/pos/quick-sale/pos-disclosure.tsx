"use client";

import * as React from "react";

import { Button } from "@/shared/ui/button";

/**
 * El bloque de **progressive disclosure** de la venta rápida.
 *
 * La ley del POS (`CONTENT.md` §9) es que lo que el cajero necesita *a veces* —correo, promo, factura,
 * descuento, dividir el pago, ventas en espera— no ocupe el lugar de lo que necesita *siempre*. Acá vive esa
 * capa: un disparador con su estado (`aria-expanded` + `aria-controls`) y el contenido montado solo cuando
 * está abierto.
 *
 * Tres decisiones:
 *
 * 1. **El contenido se monta al abrir**. No es una optimización: es lo que hace que un campo obligatorio de
 *    una opción apagada no entre a la validación del cobro (una factura sin RUC no puede bloquear una venta
 *    que no pidió factura).
 * 2. **El disparador es un `Button` del sistema**, no un `<details>` ni un `div` con `onClick`: hereda foco,
 *    tamaño táctil, estado y `motion-reduce`.
 * 3. **La flecha comunica el estado**, no solo el color, y el texto del disparador es el label de la acción
 *    (`CONTENT.md` §5): no lleva una frase abajo explicando lo que el botón ya dice.
 */
export function PosDisclosure({
  label,
  defaultOpen = false,
  children,
}: {
  /** El label del disparador: dice qué se abre, no cómo usarlo. */
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const contentId = React.useId();

  return (
    <div className="border-t border-line-subtle pt-2">
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full justify-between px-0 text-left"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="font-medium">{label}</span>
        <span
          aria-hidden="true"
          className={`text-st-caption text-ink-muted transition-transform duration-200 motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </Button>

      {open ? (
        <div id={contentId} className="space-y-3 pb-1 pt-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** El rótulo de un grupo de la venta, con la tipografía de etiqueta del panel (DS v4). */
export function OverlineLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-panel-overline font-bold uppercase tracking-wider text-ink-muted">{children}</p>
  );
}

/**
 * La misma capa, con el contenido montado **solo cuando está abierto**.
 *
 * Es la variante de las opciones de la venta (promo, descuento, ventas en espera): un formulario de una
 * opción apagada no puede existir en la pantalla —ni en el árbol accesible, ni en la validación del cobro—.
 * El estado propio de cada panel es efímero a propósito: lo que importa (el cupón aplicado, el descuento
 * autorizado, las esperas) vive en la pantalla, no adentro del panel.
 */
export function PosOptionsDisclosure({
  label,
  open,
  onToggle,
  children,
}: {
  label: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const contentId = React.useId();

  return (
    <div className="border-t border-line-subtle pt-2">
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full justify-between px-0 text-left"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={onToggle}
      >
        <span className="font-medium">{label}</span>
        <span
          aria-hidden="true"
          className={`text-st-caption text-ink-muted transition-transform duration-200 motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </Button>

      {open ? (
        <div id={contentId} className="space-y-3 pb-1 pt-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}
