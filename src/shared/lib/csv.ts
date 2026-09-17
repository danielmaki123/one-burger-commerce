/**
 * Tarea 10 del brief (2026-09-17) — los primitivos del **CSV** de los papeles de caja.
 *
 * Los escribió el export de cierres (Bloque 11.3) y los necesitaba también la conciliación de tarjeta y
 * transferencia: dos copias de la misma regla de escapado terminan en dos archivos que se abren distinto.
 * Las decisiones del formato están acá y son por una razón concreta:
 *
 * - **Separador `;`**: el formato de moneda del negocio escribe `1.234,00` (coma decimal), así que con una
 *   coma como separador el archivo se desarmaría en columnas al abrirlo en una planilla.
 * - **Números crudos** (`1500.00`, `-50.00`), sin símbolo de moneda: una planilla no entiende `C$` y
 *   ordenar como texto rompe cualquier suma.
 * - **Lo que no existe queda vacío**, no en cero: no se contó, y un 0 afirmaría que la caja estaba vacía.
 * - **Escapado**: un campo con el separador, comillas o salto de línea va entre comillas y sus comillas
 *   dobladas; si no, una nota parte la fila.
 */

export const CSV_SEPARATOR = ";";

/** Sin símbolo y con punto decimal: es lo que una planilla suma. `null`/`undefined` = celda vacía. */
export function csvAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";

  return value.toFixed(2);
}

/** Escapa un campo: entre comillas si trae separador, comillas o salto, y dobla las comillas. */
export function escapeCsvField(value: string): string {
  if (
    value.includes(CSV_SEPARATOR) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/** El archivo completo: encabezado, filas y **CRLF** (es lo que Excel y las planillas esperan). */
export function buildCsvText(
  header: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  return [header, ...rows]
    .map((row) =>
      row
        // Un número se escribe como monto (`1500.00`): ya viene calculado, no es texto de nadie.
        .map((field) => escapeCsvField(typeof field === "number" ? csvAmount(field) : (field ?? "")))
        .join(CSV_SEPARATOR),
    )
    .join("\r\n");
}

/** `cierres-camino-de-oriente-2026-09-17.csv`: sin espacios, acentos ni dos puntos. */
export function buildCsvFileName(prefix: string, locationName: string, date: string): string {
  const slug = locationName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${prefix}-${slug}-${date}.csv`;
}
