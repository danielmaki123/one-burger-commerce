import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";

/**
 * Contrato anti-hardcode.
 *
 * Recorre el código de `src/` y falla si un dato del negocio (nombre, teléfono,
 * redes, horario o símbolo de moneda por defecto) vuelve a aparecer escrito a
 * mano fuera del módulo de defaults. Es el test que cierra el objetivo de
 * `ops/tasks/TASK-whitelabel-branding.md`: si alguien lo reintroduce, esto se
 * pone rojo.
 */

const repoRoot = path.resolve(__dirname, "../../..");
const srcRoot = path.join(repoRoot, "src");

/** Único lugar del código donde pueden vivir los literales del negocio. */
const ALLOWED_FILES = new Set([
  "src/modules/business-settings/domain/business-settings-defaults.ts",
]);

/**
 * Módulos fuera del MVP (reservas, mesas, delivery, inventario): no se ofrecen
 * en la navegación ni en las APIs públicas, así que conservan sus propias reglas
 * y quedan fuera de este contrato.
 */
const EXCLUDED_PREFIXES = [
  "src/modules/reservations/",
  "src/modules/tables/",
  "src/modules/table-ordering/",
  "src/modules/inventory/",
  // La UI de reservas del admin (fuera del MVP, solo por URL directa) sigue con su
  // propia zona horaria fija. Es la contraparte de `src/modules/reservations/`.
  "src/app/(admin)/admin/reservations/",
];

const FORBIDDEN_LITERALS = [
  DEFAULT_BUSINESS_SETTINGS.name,
  `+${DEFAULT_BUSINESS_SETTINGS.whatsapp}`,
  DEFAULT_BUSINESS_SETTINGS.whatsapp!,
  DEFAULT_BUSINESS_SETTINGS.instagram!,
  DEFAULT_BUSINESS_SETTINGS.currencySymbol,
  "12:00",
  "22:00",
  /**
   * La **zona horaria del negocio** y el offset de Managua.
   *
   * El 2026-09-12 aparecieron tres lugares con la zona fija (la bandeja del admin, el tablero y el
   * historial del cliente) mientras el checkout ya usaba la configuración: un negocio en otra zona
   * veía el turno del día equivocado. La zona vive en `BusinessSettings.timezone` (con
   * `America/Managua` como **valor por defecto** en el módulo de defaults) y en el código se lee de
   * ahí. Un ejemplo de la ayuda de un campo no es el dato del negocio: para eso está la lista de
   * archivos permitidos, no este contrato.
   */
  "America/Managua",
  "-06:00",
];

/** Colores del sistema visual viejo: tienen que salir de `--brand`/`--background`. */
const FORBIDDEN_BRAND_COLORS = [
  "rgba(43,108,150",
  "rgba(43, 108, 150",
  "#fcfaf6",
  "#f4f2ec",
  "#fdfbf7",
  "#fffdf8",
  "#f4ecde",
  "#f7f1e6",
  "#eef2f5",
  "#edf1f5",
];

/**
 * Quita comentarios para revisar solo el código.
 *
 * Un literal en un comentario es documentación y no puede filtrarse al sitio;
 * además hay docstrings que citan los valores por defecto a propósito. El
 * contenido de los strings **sí** se revisa: un `"C$0.00"` o un teléfono dentro
 * de un string es exactamente el hardcodeo que este test persigue.
 */
function withoutComments(source: string): string {
  let result = "";
  let index = 0;
  let quote: string | null = null;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      result += char;
      if (char === "\\") {
        result += next ?? "";
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      result += char;
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index += 2;
      continue;
    }

    result += char;
    index += 1;
  }

  return result;
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return listSourceFiles(fullPath);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.test\.tsx?$/.test(entry.name)) return [];

    return [fullPath];
  });
}

describe("contrato anti-hardcode", () => {
  it("no quedan literales del negocio fuera del módulo de defaults", () => {
    const offenders: string[] = [];

    for (const file of listSourceFiles(srcRoot)) {
      const relative = path.relative(repoRoot, file).split(path.sep).join("/");
      if (ALLOWED_FILES.has(relative)) continue;
      if (EXCLUDED_PREFIXES.some((prefix) => relative.startsWith(prefix))) continue;

      const code = withoutComments(readFileSync(file, "utf8"));

      for (const literal of FORBIDDEN_LITERALS) {
        if (code.includes(literal)) {
          offenders.push(`${relative} → "${literal}"`);
        }
      }
    }

    expect(
      offenders,
      `Estos archivos hardcodean datos del negocio. Tienen que salir de la configuración (src/modules/business-settings):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("el módulo de defaults sigue siendo el único con los literales", () => {
    const defaults = readFileSync(
      path.join(srcRoot, "modules/business-settings/domain/business-settings-defaults.ts"),
      "utf8",
    );

    expect(defaults).toContain(DEFAULT_BUSINESS_SETTINGS.name);
    expect(defaults).toContain(DEFAULT_BUSINESS_SETTINGS.whatsapp!);
    expect(defaults).toContain(DEFAULT_BUSINESS_SETTINGS.instagram!);
    expect(defaults).toContain(DEFAULT_BUSINESS_SETTINGS.currencySymbol);
    // La zona horaria del negocio también: es un dato editable, y su valor por defecto es lo único
    // que puede estar escrito. Si alguien la borra de la lista de prohibidos, esto no lo detecta,
    // pero sí deja claro dónde vive el dato (y el contrato de arriba es el que la persigue).
    expect(defaults).toContain(DEFAULT_BUSINESS_SETTINGS.timezone);
  });

  it("los fondos salen de los tokens: ningun color del sistema viejo escrito a mano", () => {
    // Cada página tenía su propio degradado con el azul y los cremas fijos, así
    // que cambiar los colores en el admin solo se veía en la home. Ahora usan
    // `.brand-canvas`, `.brand-surface`, `.brand-photo`, `.brand-overlay` o
    // `.brand-hero-fallback`, que salen de `--brand` y `--background`.
    const offenders: string[] = [];

    for (const file of listSourceFiles(srcRoot)) {
      const relative = path.relative(repoRoot, file).split(path.sep).join("/");
      // `globals.css` es el único lugar con literales de color: son los tokens
      // de respaldo del sistema visual.
      if (relative === "src/app/globals.css") continue;

      const code = withoutComments(readFileSync(file, "utf8"));

      for (const literal of FORBIDDEN_BRAND_COLORS) {
        if (code.includes(literal)) {
          offenders.push(`${relative} → "${literal}"`);
        }
      }
    }

    expect(
      offenders,
      `Estos archivos fijan colores del sistema viejo en vez de usar los tokens:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
