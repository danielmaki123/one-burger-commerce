/**
 * Tarea 10 del brief (2026-09-17) — **bajar un archivo de texto** desde el navegador.
 *
 * Lo hacía a mano el export de cierres (Bloque 11.3): crear el blob, un enlace con `download`, el
 * `click()` y liberar la URL. La conciliación de tarjeta y transferencia necesita exactamente lo mismo,
 * así que vive acá —y con el `revoke` incluido, que es lo que se olvida y deja la memoria del blob colgada
 * mientras la pestaña esté abierta—.
 *
 * Sin DOM devuelve `false`: el texto ya está armado por una función pura y quien llama decide qué decir.
 */

export function downloadTextFile(input: {
  fileName: string;
  content: string;
  /** Por defecto, texto plano: es lo mismo que hace un enlace `download`. */
  mimeType?: string;
}): boolean {
  if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") return false;

  const url = URL.createObjectURL(
    new Blob([input.content], { type: input.mimeType ?? "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");

  link.href = url;
  link.download = input.fileName;
  link.click();
  URL.revokeObjectURL(url);

  return true;
}
