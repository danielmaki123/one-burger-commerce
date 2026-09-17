"use client";

import { printLines } from "@/shared/lib/print-lines";
import { Button } from "@/shared/ui/button";

/**
 * Bloque 13.3 del roadmap del POS (Fase 2) — imprimir la hoja de cierre (y firmarla).
 *
 * El **texto** llega ya armado por el servidor (`buildShiftCloseSheet`, función pura y probada): acá
 * solo se manda a imprimir con `printLines` (ventana nueva + `print()`, sin dependencias ni impresora de
 * red). Las líneas viajan como **datos** (`string[]`) y no como una función: pasar funciones de un
 * componente de servidor a uno de cliente revienta en tiempo de ejecución con «Functions cannot be
 * passed directly to Client Components» y el build no lo ve.
 */
export default function ShiftCloseSheetButton({ lines }: { lines: string[] }) {
  return (
    <Button type="button" variant="outline" className="min-h-11" onClick={() => printLines(lines)}>
      Imprimir cierre
    </Button>
  );
}
