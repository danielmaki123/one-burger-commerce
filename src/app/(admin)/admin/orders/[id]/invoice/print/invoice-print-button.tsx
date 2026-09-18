"use client";

import { Button } from "@/shared/ui/button";

/**
 * Factura simple (2026-09-18) — el botón que manda la hoja A4 a imprimir (o a guardar como PDF).
 *
 * Es lo único con JavaScript de la página del documento: `window.print()` del navegador, sin dependencias y
 * sin generador de PDF en el servidor (la misma decisión que la hoja de cierre, 1.6). El botón se oculta al
 * imprimir para que no salga en el papel.
 */
export default function InvoicePrintButton() {
  return (
    <Button
      type="button"
      className="min-h-11 print:hidden"
      onClick={() => window.print()}
    >
      Imprimir
    </Button>
  );
}
