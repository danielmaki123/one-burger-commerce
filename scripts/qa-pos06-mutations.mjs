/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §53) — **mutation checks**: se reintroduce la condición
 * defectuosa, se observa el rojo y se restaura. La mutación **no se commitea**.
 *
 * Se corre con `node scripts/qa-pos06-mutations.mjs` y cada caso imprime `RED` (el test falló, que es lo
 * que se busca) o `GREEN (mutación no detectada)`. Al final restaura el archivo desde su copia.
 *
 * No es un test del repo: es la herramienta con la que se midió la evidencia que el brief pide (§53) y
 * queda versionada para que la medición sea reproducible.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const MUTATIONS = [
  {
    id: "quitar-el-lock-del-pedido",
    file: "src/modules/orders/features/register-order-payment/register-order-payment.ts",
    from: "const lockedOrder = await scope.lockOrder(order.id);",
    to: "const lockedOrder = await scope.lockOrder(order.id); if (!lockedOrder) return [];",
    test: "src/modules/orders/features/register-order-payment/register-order-payment.postgres.test.ts",
    reason: "el lock del pedido es lo que serializa dos liquidaciones simultáneas",
  },
  {
    id: "quitar-la-idempotencia",
    file: "src/modules/orders/features/register-order-payment/register-order-payment.ts",
    from: "const replayed = await scope.findSettlementPayments(idempotencyKey);\n        if (replayed.length > 0) return replayed;",
    to: "const replayed: never[] = [];",
    test: "src/modules/orders/features/register-order-payment/register-order-payment.postgres.test.ts",
    reason: "sin el chequeo de la clave, un reintento registra la plata dos veces",
  },
  {
    id: "permitir-overpayment",
    file: "src/modules/payments/domain/order-settlement.ts",
    from: "return rawDifference < 0",
    to: "return false && rawDifference < 0",
    test: "src/modules/payments/domain/order-settlement.test.ts",
    reason: "el sobrecobro partido tiene que rechazarse",
  },
  {
    id: "permitir-underpayment",
    file: "src/modules/payments/domain/order-settlement.ts",
    from: "return rawDifference < 0",
    to: "return true || rawDifference < 0",
    test: "src/modules/payments/domain/order-settlement.test.ts",
    reason: "la liquidación parcial (abono comercial) no existe",
  },
  {
    id: "ignorar-el-scope",
    file: "src/modules/orders/features/list-pos-operational-orders/list-pos-operational-orders.ts",
    from: "locationIds: [input.locationId],",
    to: "locationIds: undefined,",
    test: "src/modules/orders/features/list-pos-operational-orders/list-pos-operational-orders.test.ts",
    reason: "el feed operacional no puede devolver pedidos de otra sucursal",
  },
  {
    id: "ignorar-isActive",
    file: "src/modules/payments/domain/payment-method-availability.ts",
    from: "  if (!method.isActive) return false;",
    to: "  if (false) return false;",
    test: "src/modules/payments/domain/payment-method-availability.test.ts",
    reason: "un medio apagado en Finanzas no se puede cobrar",
  },
  {
    id: "ignorar-la-disponibilidad-por-local",
    file: "src/modules/payments/domain/payment-method-availability.ts",
    from: "  if (method.locations.length === 0) return true;",
    to: "  return true;\n  // eslint-disable-next-line no-unreachable\n  if (method.locations.length === 0) return true;",
    test: "src/modules/payments/domain/payment-method-availability.test.ts",
    reason: "la disponibilidad por sucursal es una regla del medio",
  },
  {
    id: "ignorar-requiresReference",
    file: "src/app/api/admin/orders/[id]/payment/payment-composition.ts",
    from: "    if (resolved.requiresReference && !payment.reference?.trim()) {",
    to: "    if (false && !payment.reference?.trim()) {",
    test: "src/app/api/admin/orders/[id]/payment/route.test.ts",
    reason: "la referencia la exige el medio configurado, no la pantalla",
  },
  {
    id: "permitir-cashier-a-cancelled",
    file: "src/app/api/admin/orders/order-status-authorization.ts",
    from: '  if (input.next !== "picked_up" || input.current !== "ready_for_pickup") {',
    to: "  if (false) {",
    test: "src/app/api/admin/orders/[id]/status/route.test.ts",
    reason: "la puerta nominal sólo firma la entrega",
  },
  {
    id: "permitir-cashier-a-preparing",
    file: "src/modules/auth/domain/admin-permissions.ts",
    from: "    role === ADMIN_ROLES.cashier\r\n  );",
    to: "    role === ADMIN_ROLES.cashier ||\r\n    role === ADMIN_ROLES.kitchen\r\n  );",
    test: "src/modules/auth/domain/admin-permissions.test.ts",
    reason: "cocina no entrega ni maneja plata",
  },
  {
    id: "kpi-sobre-filas-visibles",
    file: "src/modules/orders/domain/pos-operational-orders.ts",
    from: "    if (item.ready) summary.ready += 1;",
    to: "    if (item.ready && item.inProcess) summary.ready += 1;",
    test: "src/modules/orders/domain/pos-operational-orders.test.ts",
    reason: "los KPI son dimensiones superpuestas, no excluyentes",
  },
  {
    id: "programados-por-createdAt",
    file: "src/modules/orders/features/list-pos-operational-orders/list-pos-operational-orders.ts",
    from: '      const byPickup = (a.pickupTime ?? "").localeCompare(b.pickupTime ?? "");\n      if (byPickup !== 0) return byPickup;',
    to: '      const byPickup = 0;\n      if (byPickup !== 0) return byPickup;',
    test: "src/modules/orders/features/list-pos-operational-orders/list-pos-operational-orders.test.ts",
    reason: "los programados se ordenan por hora prometida, no por creación",
  },
  {
    id: "landing-del-cajero-vuelve-a-pedidos",
    file: "src/modules/auth/domain/admin-landing.ts",
    from: '  if (role === ADMIN_ROLES.cashier) return ADMIN_LANDING.pos;',
    to: '  if (role === ADMIN_ROLES.cashier) return ADMIN_LANDING.orders;',
    test: "src/modules/auth/domain/admin-landing.test.ts",
    reason: "el workspace operativo del cajero es el POS",
  },
];

const results = [];

for (const mutation of MUTATIONS) {
  const original = readFileSync(mutation.file, "utf8");

  if (!original.includes(mutation.from)) {
    results.push({ ...mutation, outcome: "NO-APLICABLE (patrón no encontrado)" });
    continue;
  }

  writeFileSync(mutation.file, original.replace(mutation.from, mutation.to), "utf8");

  let outcome;
  try {
    execFileSync("npx", ["vitest", "run", "--reporter=dot", mutation.test], {
      stdio: "pipe",
      shell: true,
    });
    outcome = "GREEN (mutación NO detectada)";
  } catch {
    outcome = "RED";
  }

  writeFileSync(mutation.file, original, "utf8");
  results.push({ ...mutation, outcome });
}

for (const result of results) {
  console.log(`${result.outcome.padEnd(30)} ${result.id} — ${result.reason}`);
}

const undetected = results.filter((result) => result.outcome !== "RED");

console.log(
  `\n${results.length - undetected.length}/${results.length} mutaciones detectadas (rojo observado).`,
);

if (undetected.length > 0) {
  console.log("No detectadas:");
  for (const result of undetected) console.log(`  - ${result.id}: ${result.outcome}`);
  process.exitCode = 1;
}
