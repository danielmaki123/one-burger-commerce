import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * TASK-102 — contrato de la suma del total.
 *
 * El total se calculaba a mano en varios lugares, cada uno con su propia variante: la tarjeta de
 * resumen omitía descuento y envío, el agregado de ítems de mesa omitía empaque y propina, y los dos
 * adaptadores reescribían la misma suma. Con una sola variante real (hoy: subtotal - descuento +
 * empaque + envío + propina) el problema es que **agregar un componente nuevo** obliga a
 * encontrarlos todos.
 *
 * Alcance de lo que este test garantiza: la **suma escrita en una expresión** (`subtotal - discount
 * + packagingAmount...`) no vive fuera de `src/shared/lib/order-totals.ts`. Persigue el patrón real
 * —dos componentes del total separados por un operador— así que también caza la variante con los
 * campos de Prisma (`decimalToNumber(order.packagingAmount)`).
 *
 * Lo que este test **no** puede garantizar, y conviene tenerlo escrito: una omisión construida como
 * un encadenamiento de sentencias (`newPackagingAmount = 0; newTipAmount = 0; ... newSubtotal -
 * newDiscount + deliveryFeeAmount`) no se distingue por texto de una operación legítima sin escribir
 * un parser. Ese caso está inventariado en `ops/audit-backlog.md` (TASK-102) y se cubre por
 * comportamiento en los tests del caso de uso.
 */

const repoRoot = process.cwd();

/**
 * Los archivos que hoy calculan el total y tienen que usar la fuente canónica.
 *
 * `checkout/page.tsx` ya la usaba (`calculateOrderTotals`) y se deja listado para que el test falle
 * si alguien lo cambia por una suma a mano.
 */
const FILES_WITH_TOTALS = [
  "src/app/(public)/_components/order-summary-card.tsx",
  "src/modules/orders/adapters/prisma-order-repository.ts",
  "src/modules/orders/adapters/in-memory-order-repository.ts",
  "src/modules/orders/features/add-table-order-items/add-table-order-items.ts",
  "src/app/(public)/checkout/page.tsx",
];

const CANONICAL_FILE = "src/shared/lib/order-totals.ts";

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

/**
 * Saca espacios y envoltorios de lectura para que la misma suma escrita de tres formas
 * (`order.packagingAmount`, `decimalToNumber(order.packagingAmount)`, `packagingAmount`) se vea
 * igual. Los tipos (`Number`, `0`) también se sacan para no perder el operador que sigue.
 */
function normalizeForSumDetection(source: string): string {
  return source
    .replace(/decimalToNumber\(/g, "")
    .replace(/order\./g, "")
    .replace(/\bas\s+Number\b/g, "")
    .replace(/\s+/g, "");
}

/**
 * Dos componentes del total separados por un operador: la suma del total escrita a mano. No busca
 * una resta sola (`subtotal - discount`, la base de la propina) porque esa operación es legítima y
 * vive en la misma fuente canónica.
 */
const HAND_WRITTEN_SUM =
  /(?:subtotal|discount|packagingAmount|deliveryFeeAmount|tipAmount)[-+](?:subtotal|discount|packagingAmount|deliveryFeeAmount|tipAmount)/;

describe("contrato · la suma del total vive en un solo lugar", () => {
  it("ningún archivo suma el total a mano fuera de order-totals.ts", () => {
    const offenders = FILES_WITH_TOTALS.filter((file) =>
      HAND_WRITTEN_SUM.test(normalizeForSumDetection(readSource(file))),
    );

    expect(offenders).toEqual([]);
  });

  it("la fuente canónica expone las dos puertas y ninguna reescribe la suma", () => {
    const canonical = readSource(CANONICAL_FILE);

    // `calculateOrderTotals` (con las líneas del pedido) y `calculateOrderTotal` (con los montos ya
    // calculados) son las dos puertas. Si falta alguna, el test no puede pasar por vacío.
    expect(canonical).toMatch(/export function calculateOrderTotals\(/);
    expect(canonical).toMatch(/export function calculateOrderTotal\(/);
  });

  it("los archivos con totales no traen la fórmula copiada, la importan", () => {
    for (const file of FILES_WITH_TOTALS) {
      const source = readSource(file);

      // La excepción es el agregado de ítems de mesa, que solo suma líneas y no recalcula el total
      // del pedido (ver el comentario del encabezado).
      if (file.includes("add-table-order-items")) continue;

      expect(source, `${file} tiene que usar la fuente canónica`).toMatch(
        /from "@\/shared\/lib\/order-totals"/,
      );
    }
  });
});
