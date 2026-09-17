"use client";

import { Button } from "@/shared/ui/button";

/**
 * Bloque 13.3 del roadmap del POS (Fase 2) — imprimir la hoja de cierre (y firmarla).
 *
 * El **texto** llega ya armado por el servidor (`buildShiftCloseSheet`, función pura y probada): acá
 * solo se abre una ventana con esas líneas y se llama a `print()`, igual que el ticket de cocina (sin
 * dependencias ni impresora de red, la decisión del owner para el bloque de impresión).
 *
 * Las líneas viajan como **datos** (`string[]`) y no como una función: pasar funciones de un componente
 * de servidor a uno de cliente revienta en tiempo de ejecución con «Functions cannot be passed directly
 * to Client Components» y el build no lo ve.
 */
export default function ShiftCloseSheetButton({ lines }: { lines: string[] }) {
  function print() {
    const ventana = window.open("", "_blank", "width=420,height=680");
    if (!ventana) return;

    ventana.document.write(
      `<pre style="font: 13px/1.5 ui-monospace, monospace; margin: 0; padding: 16px; white-space: pre-wrap; word-break: break-word;">${lines.join("\n")}</pre>`,
    );
    ventana.document.close();
    ventana.focus();
    ventana.print();
  }

  return (
    <Button type="button" variant="outline" className="min-h-11" onClick={print}>
      Imprimir cierre
    </Button>
  );
}
