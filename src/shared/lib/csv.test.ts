import { describe, expect, it } from "vitest";

import {
  buildCsvFileName,
  buildCsvText,
  csvAmount,
  CSV_SEPARATOR,
  escapeCsvField,
} from "./csv";

/**
 * Tarea 10 del brief (2026-09-17) — los primitivos del **CSV** que ahora comparten los dos exports
 * (cierres y conciliación).
 *
 * Estaban dentro del export de cierres; se extrajeron para que el archivo de conciliación no fuera una
 * segunda copia. Lo que se fija acá es lo que rompe un archivo al abrirlo en una planilla: el separador,
 * el escapado, los números crudos y el nombre del archivo.
 */

describe("csvAmount", () => {
  it("escribe el número crudo, con punto decimal y sin símbolo", () => {
    expect(csvAmount(1500)).toBe("1500.00");
    expect(csvAmount(-50.5)).toBe("-50.50");
    // Una planilla no entiende `C$`: con símbolo, ordenar y sumar quedan como texto.
    expect(csvAmount(1234.567)).toBe("1234.57");
  });

  it("lo que no existe queda vacío, no en cero", () => {
    expect(csvAmount(null)).toBe("");
    expect(csvAmount(undefined)).toBe("");
    // Cero sí es un dato (una caja vacía).
    expect(csvAmount(0)).toBe("0.00");
  });
});

describe("escapeCsvField", () => {
  it("deja el texto simple como está", () => {
    expect(escapeCsvField("Camino de Oriente")).toBe("Camino de Oriente");
  });

  it("encierra entre comillas lo que tiene separador, comillas o salto de línea", () => {
    expect(escapeCsvField("Nota; con separador")).toBe('"Nota; con separador"');
    expect(escapeCsvField('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(escapeCsvField("dos\nlíneas")).toBe('"dos\nlíneas"');
  });
});

describe("buildCsvText", () => {
  it("arma el encabezado y las filas con el separador y CRLF", () => {
    const text = buildCsvText(
      ["Pedido", "Monto"],
      [
        ["P-1", 1500],
        ["P-2", null],
      ],
    );

    expect(text.split("\r\n")).toEqual(["Pedido;Monto", "P-1;1500.00", "P-2;"]);
    expect(text).toContain(CSV_SEPARATOR);
  });

  it("escapa cada campo, también los que vienen de datos del negocio", () => {
    const text = buildCsvText(["Local", "Nota"], [["Casa; Antigua", 'Con "comillas"']]);

    expect(text.split("\r\n")[1]).toBe('"Casa; Antigua";"Con ""comillas"""');
  });
});

describe("buildCsvFileName", () => {
  it("saca acentos, espacios y dos puntos: el sistema los odia", () => {
    expect(buildCsvFileName("conciliacion", "Casa Antigua", "2026-09-17")).toBe(
      "conciliacion-casa-antigua-2026-09-17.csv",
    );
  });

  it("un nombre sin acentos ni espacios queda igual", () => {
    expect(buildCsvFileName("cierres", "Principal", "2026-09-17")).toBe(
      "cierres-principal-2026-09-17.csv",
    );
  });
});
