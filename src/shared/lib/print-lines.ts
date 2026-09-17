/**
 * Bloque 10 del roadmap del POS (Fase 2) — imprimir un texto con la hoja del sistema.
 *
 * Los tres papeles del POS (ticket de cocina, ticket de cliente y hoja de cierre) hacen exactamente lo
 * mismo: abrir una ventana, escribir el texto y llamar a `print()`. Estaba copiado en cada pantalla;
 * vive acá para que la impresión —y el escapado del texto— se arregle en un solo lugar. Sin
 * dependencias ni impresora de red: es la decisión del owner para este bloque.
 *
 * El texto se **escapa**: lo que se imprime viene de datos del negocio (nombres de producto, notas del
 * cliente) y un `<` suelto rompería la hoja en vez de salir impreso.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Abre una ventana con las líneas y manda a imprimir. Devuelve `false` cuando el navegador bloquea la
 * ventana emergente: la operación que originó el papel (el cobro, el cierre) ya ocurrió, así que no hay
 * nada que revertir — se avisa y se sigue.
 */
export function printLines(lines: string[]): boolean {
  if (typeof window === "undefined") return false;

  const ventana = window.open("", "_blank", "width=420,height=680");
  if (!ventana) return false;

  ventana.document.write(
    `<pre style="font: 13px/1.5 ui-monospace, monospace; margin: 0; padding: 16px; white-space: pre-wrap; word-break: break-word;">${escapeHtml(
      lines.join("\n"),
    )}</pre>`,
  );
  ventana.document.close();
  ventana.focus();
  ventana.print();

  return true;
}
