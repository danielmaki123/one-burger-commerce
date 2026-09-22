import { describe, expect, it } from "vitest";

import { buildShiftCsv, buildShiftCsvFileName, CSV_SEPARATOR } from "./shift-csv";

/**
 * Bloque 11.3 del roadmap del POS (Fase 2) — el export de cierres.
 *
 * El CSV lo arma una función pura para que se pueda probar sin navegador (la descarga es del
 * navegador). Tres cosas que importan para que el archivo sirva en una planilla:
 *
 * - **separador `;`** y no coma: el formato de moneda del negocio usa la coma como separador decimal,
 *   así que con `,` el archivo se desarma en columnas al abrirlo;
 * - los números van **sin símbolo** y con punto decimal (una planilla no entiende `C$1,234.00`);
 * - un campo con el separador o comillas se escapa entre comillas, o una nota con `;` parte la fila.
 */
const shift = {
  id: "shift_01",
  status: "closed" as const,
  openedAt: "2026-09-17T14:00:00.000Z",
  closedAt: "2026-09-17T22:00:00.000Z",
  openingAmount: 1000,
  closingAmount: 1450,
  expectedAmount: 1500,
  difference: -50,
  cashSalesAmount: 700,
  cashMovementsAmount: -250,
  refundsAmount: -100,
  notes: "Faltó cambio; se devolvió un pedido",
};

const options = { timezone: "America/Managua", locale: "es-NI", locationName: "Camino de Oriente" };

describe("CSV de cierres", () => {
  it("usa punto y coma y encabeza con las columnas del arqueo", () => {
    const csv = buildShiftCsv([shift], options);
    const [header, row] = csv.split("\r\n");

    expect(header.split(CSV_SEPARATOR)).toEqual([
      "Local",
      "Apertura",
      "Cierre",
      "Fondo",
      "Contado",
      "Esperado",
      "Diferencia",
      "Efectivo del turno",
      "Movimientos",
      "Devoluciones",
      "Notas",
    ]);
    // La fila trae los 11 campos: el local va escapado por el espacio no, pero un campo con el
    // separador sí, así que se cuentan comillas afuera.
    expect(row.startsWith("Camino de Oriente" + CSV_SEPARATOR)).toBe(true);
    expect(row.split(CSV_SEPARATOR)).toHaveLength(12);
  });

  it("escribe los montos con punto decimal y sin símbolo de moneda", () => {
    const [, row] = buildShiftCsv([shift], options).split("\r\n");

    expect(row).toContain("1500.00");
    expect(row).toContain("-50.00");
    expect(row).not.toContain("C$");
  });

  it("escapa el campo que trae el separador o comillas", () => {
    const conComillas = { ...shift, notes: 'Nota con "comillas"' };
    const [, row] = buildShiftCsv([conComillas], options).split("\r\n");

    expect(row).toContain('"Nota con ""comillas"""');
    // Una nota con `;` no puede partir la fila en columnas de más.
    const conPuntoYComa = { ...shift, notes: "Primera; segunda" };
    const filas = buildShiftCsv([conPuntoYComa], options).split("\r\n");
    expect(filas).toHaveLength(2);
  });

  it("un turno abierto escribe los montos de cierre vacíos, no ceros", () => {
    const abierto = {
      ...shift,
      status: "open" as const,
      closedAt: null,
      closingAmount: null,
      expectedAmount: null,
      difference: null,
    };

    const [, row] = buildShiftCsv([abierto], options).split("\r\n");
    const columnas = row.split(CSV_SEPARATOR);

    // Contado, esperado y diferencia: vacíos.
    expect(columnas[4]).toBe("");
    expect(columnas[5]).toBe("");
    expect(columnas[6]).toBe("");
  });

  it("sin turnos devuelve solo el encabezado", () => {
    expect(buildShiftCsv([], options).split("\r\n")).toHaveLength(1);
  });

  it("el nombre del archivo dice el local y la fecha sin espacios ni dos puntos", () => {
    const nombre = buildShiftCsvFileName("Camino de Oriente", "2026-09-17");

    expect(nombre).toBe("cierres-camino-de-oriente-2026-09-17.csv");
  });

  /**
   * Fase 1b del rediseño de Caja (2026-09-19) — el export se muda al **Historial**, que cruza sucursales
   * (`/admin/history/cierres`). El CSV se armaba con **un** local para todas las filas porque su única
   * pantalla miraba una sucursal; con la lista de todas, cada fila tiene que decir la suya o el archivo
   * mentiría sobre de dónde salió cada cierre.
   */
  it("el local de cada fila manda sobre el del archivo (la lista puede cruzar sucursales)", () => {
    const deOtraSucursal = { ...shift, locationName: "Casa Antigua" };

    const [, row] = buildShiftCsv([deOtraSucursal], options).split("\r\n");

    expect(row.startsWith("Casa Antigua" + CSV_SEPARATOR)).toBe(true);
  });

  it("sin local en la fila, el archivo usa el que se le pasa (una sola sucursal)", () => {
    const [, row] = buildShiftCsv([shift], options).split("\r\n");

    expect(row.startsWith("Camino de Oriente" + CSV_SEPARATOR)).toBe(true);
  });
});
