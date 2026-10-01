import { expect, test, type Page } from "@playwright/test";

import type {
  PosOperationalFeed,
  PosOperationalOrder,
} from "@/modules/orders/domain/pos-operational-orders";

import { createAdminUserViaUi, loginAsOwner, logoutAdmin, mutationsAllowed } from "./helpers";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (orden **6** del roadmap) — **el POS operativo del cajero**, medido en un
 * navegador real.
 *
 * Lo que este archivo cubre es lo que el brief del owner fija para la **superficie** y ninguna prueba
 * unitaria puede ver:
 *
 * 1. **La banda de KPI operacionales**: cuatro contadores (`pos-kpi-process`, `pos-kpi-ready`,
 *    `pos-kpi-pending-payment`, `pos-kpi-scheduled`) debajo de la barra de contexto, diciendo el número que
 *    calculó **el servidor** (`GET /api/admin/pos/operational-orders`), sin scroll horizontal de página.
 * 2. **Un solo panel reutilizable** (`data-testid="pos-operational-panel"`, `role="dialog"`) para los cuatro
 *    modos: el brief prohíbe cuatro modales independientes (la deuda `A-92` son justamente dos `<dialog
 *    open>` donde el que recibe el toque no es el que el test cree).
 * 3. **El modo «pedido existente»** (`/admin/pos?orderId=<id>`, `data-testid="pos-existing-order-panel"`): el
 *    pedido se abre **inmutable** —sin catálogo ni alta de productos— porque agregarle líneas sería crear una
 *    segunda `Order`, y cobrarlo es del flujo canónico de Orders/Payments.
 * 4. **El landing del cajero**: su primera pantalla es su workspace operativo (el POS), no el listado
 *    administrativo de Pedidos.
 * 5. **El negativo del cobro partido**: una liquidación cuyas filas suman **más** que el saldo se rechaza, el
 *    motivo se dice en español y **no queda hecho financiero** (invariante 1: `Σ aplicado == outstanding`).
 *
 * Los casos que crean la cuenta de cajero tocan la base y piden `E2E_ALLOW_MUTATIONS=true`; los de sola
 * lectura (el pedido existente y los cuatro viewports) corren siempre con la sesión del entorno.
 *
 * Vocabulario: el **saldo** es `outstandingAmount` (lo que falta cobrar, producido por `payments`, moneda
 * base) y `overpayment` es el caso de la liquidación que lo **pasa**.
 */

/** Los cuatro viewports del Viewport Contract (`DESIGN_SYSTEM.md` §12), en el orden del contrato. */
const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
] as const;

/**
 * Las cuatro entradas de la banda, con las tres cosas que los casos necesitan de cada una y que **ya están
 * fijadas por el código de la banda** (`pos-operational-band.tsx:45-52`, `:103-105`, `:127-132`):
 *
 * - `id`: el `data-testid` del botón.
 * - `label`: el rótulo del contador, que es el prefijo de su nombre accesible (`"Listos: 4 pedidos"`).
 * - `title`: el título del panel operacional cuando ese contador lo abre.
 * - `summaryKey`: el campo del resumen del servidor del que sale el número.
 */
const KPI_ENTRIES = [
  { id: "pos-kpi-process", label: "En proceso", title: "En proceso", summaryKey: "inProcess" },
  { id: "pos-kpi-ready", label: "Listos", title: "Listos para entregar", summaryKey: "ready" },
  {
    id: "pos-kpi-pending-payment",
    label: "Por cobrar",
    title: "Por cobrar",
    summaryKey: "pendingPayment",
  },
  { id: "pos-kpi-scheduled", label: "Programados", title: "Programados", summaryKey: "scheduled" },
] as const;

/** El contador que la banda tiene que dibujar, siguiendo el orden del brief §5. */
const KPI_TEST_IDS = KPI_ENTRIES.map((entry) => entry.id);

/** Lo que devuelve el alta de la cuenta de cajero, para poder entrar con ella. */
type CashierAccount = { name: string; email: string; password: string };

/** El desborde horizontal de la página. Cero es el contrato: la página no scrollea a lo ancho. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/**
 * Crea la cuenta de **cajero** de esta corrida y entra con ella, sin afirmar dónde aterrizó.
 *
 * No se usa `loginAsCashier` (`helpers.ts:288`) a propósito: ese helper firma el login con
 * `loginWithCredentials`, que afirma `ADMIN_LANDING_PATTERN` (`helpers.ts:185` = `/admin`,
 * `/admin/orders` o `/admin/kitchen`) y **no conoce `/admin/pos`**: con el landing del cajero en el POS
 * (orden 6) ese `expect` falla antes de llegar a mirar nada. Acá se reusan sus tres pasos —crear la cuenta
 * con el dueño, cerrar su sesión y entrar con las credenciales del cajero— y el **destino lo afirma cada
 * caso** que lo necesita: el helper no lo esconde (si lo afirmara, el caso del landing quedaría sin oráculo
 * propio).
 *
 * El correo lleva la hora porque la base local acumula los usuarios de cada corrida.
 */
async function createCashierAndLogin(page: Page): Promise<CashierAccount> {
  const stamp = Date.now();
  const account: CashierAccount = {
    name: `Cajero POS ${stamp}`,
    email: `pos-cashier-${stamp}@example.com`,
    password: "Cajero1234!",
  };

  await loginAsOwner(page);
  await createAdminUserViaUi(page, { ...account, role: "cashier" });
  await logoutAdmin(page);

  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  return account;
}

/** Entra como cajero y abre el POS (por URL: el aterrizaje lo mide su propio caso). */
async function openPosAsCashier(page: Page): Promise<CashierAccount> {
  const account = await createCashierAndLogin(page);

  await page.goto("/admin/pos");
  await expect(page.getByRole("heading", { level: 1, name: "POS" })).toBeVisible();

  return account;
}

/**
 * El local que el POS está mostrando —la barra de contexto `POS · Local · Terminal · ● Caja abierta`
 * (`pos-workspace.tsx:185`)—. Es el dueño de los KPI: leer el feed de **otro** local compararía números que
 * no son los de esta pantalla.
 */
async function readPosLocationId(page: Page): Promise<string> {
  const local = page.getByLabel("Local", { exact: true });
  await expect(local).toBeVisible();

  const locationId = await local.inputValue();
  expect(locationId, "el POS necesita un local elegido para poder leer sus pedidos").not.toBe("");

  return locationId;
}

/** El feed operacional del local, leído **desde la página** (así lleva la cookie de sesión). */
async function readOperationalFeed(page: Page, locationId: string): Promise<PosOperationalFeed> {
  const result = await page.evaluate(async (id) => {
    const response = await fetch(
      `/api/admin/pos/operational-orders?locationId=${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    const body = (await response.json()) as { data?: PosOperationalFeed | null };

    return { status: response.status, data: body.data ?? null };
  }, locationId);

  if (!result.data) {
    throw new Error(
      `la ruta del feed operacional no devolvió pedidos (HTTP ${result.status}): sin feed no hay KPI que comparar`,
    );
  }

  return result.data;
}

/**
 * Deja una **caja abierta** para el local, con la misma API que dispara `Abrir caja` en el POS
 * (`use-pos-shift.ts:107`) y la terminal activa del local —la que el POS hereda para firmar la venta
 * (`admin-pos.spec.ts:43`, `ensureOpenShift`)—.
 *
 * Es necesario porque el cobro **exige** turno: sin caja, el servidor responde 409 «Abrí la caja antes de
 * cobrar.» (`register-order-payment.ts:187`) y el caso del sobrepago dejaría de medir el rechazo por el
 * saldo. Primero se pregunta si ya hay una abierta —lo que deja el caso repetible— y sólo si no la hay se
 * abre contando cero.
 */
async function ensureOpenShift(page: Page, locationId: string): Promise<boolean> {
  return page.evaluate(async (id) => {
    const terminalsResponse = await fetch(
      `/api/admin/cash/terminals?locationId=${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    const terminalsBody = terminalsResponse.ok
      ? (
          (await terminalsResponse.json()) as {
            data?:
              | { terminals?: Array<{ id: string; isActive: boolean }> }
              | Array<{ id: string; isActive: boolean }>;
          }
        ).data
      : undefined;
    // La ruta devuelve `{ terminals }`; el doble del contrato acepta también un arreglo suelto.
    const terminalsRaw = Array.isArray(terminalsBody) ? terminalsBody : terminalsBody?.terminals;
    const terminalId = (terminalsRaw ?? []).find((terminal) => terminal.isActive)?.id ?? null;

    const shiftResponse = await fetch(
      `/api/admin/pos/shift?locationId=${encodeURIComponent(id)}${
        terminalId ? `&terminalId=${encodeURIComponent(terminalId)}` : ""
      }`,
      { cache: "no-store" },
    );
    const shift = ((await shiftResponse.json()) as { data?: { id: string } | null }).data;

    if (shift) return true;

    const opened = await fetch("/api/admin/pos/shift/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: id, ...(terminalId ? { terminalId } : {}), counts: [] }),
    });

    return opened.ok;
  }, locationId);
}

/**
 * El pedido que el caso del sobrepago necesita: **cobrable** —deuda pendiente, sin plata sin resolver y con
 * saldo— y, si lo hay, `ready_for_pickup`, que es el estado con el que los criterios de aceptación documentan
 * el CTA «Cobrar» (`ready + pending → Cobrar`).
 *
 * Un `partial` con `unresolvedAmount > 0` queda afuera a propósito: el brief lo manda a **REVISAR** y lo saca
 * del flujo normal de cobro (`pos-operational-orders.ts:197-207`).
 */
function pickChargeableOrder(feed: PosOperationalFeed): PosOperationalOrder | undefined {
  const chargeable = feed.orders.filter(
    (order) =>
      order.financialState.status === "pending" &&
      order.financialState.unresolvedAmount === 0 &&
      order.financialState.outstandingAmount > 0,
  );

  return chargeable.find((order) => order.status === "ready_for_pickup") ?? chargeable[0];
}

test.describe("POS operativo del cajero (orden 6)", () => {
  // La cuenta de cajero se crea por la UI en cada caso (no hay API de usuarios para tests): el alta más el
  // login no entran en el minuto por defecto de Playwright.
  test.setTimeout(120_000);

  test("el POS muestra la banda de KPI operacional y sus cuatro contadores", async ({ page }) => {
    test.skip(!mutationsAllowed, "Crear un usuario toca la base: E2E_ALLOW_MUTATIONS=true.");

    await openPosAsCashier(page);

    // El servidor es el dueño de los números: el resumen del feed es el oráculo de lo que la banda dibuja.
    const feed = await readOperationalFeed(page, await readPosLocationId(page));

    for (const entry of KPI_ENTRIES) {
      const contador = page.getByTestId(entry.id);
      await expect(contador, `falta el contador ${entry.id}`).toBeVisible();

      // 1) Cada contador dice **un número**.
      await expect(contador).toHaveText(/\d/);

      // 2) Y es **el número que el servidor calculó**: un contador en cero hardcodeado no pasa.
      const esperado = feed.summary[entry.summaryKey];
      await expect(contador).toHaveText(new RegExp(`\\b${esperado}\\b`));

      // 3) El nombre accesible lleva el rótulo y el conteo: la banda se puede leer sin ver el color.
      await expect(
        page.getByRole("button", { name: new RegExp(`^${entry.label}: \\d+ pedidos$`) }),
      ).toBeVisible();
    }

    // La banda no empuja el ancho de la página: lo que scrollea (si hace falta) scrollea adentro suyo.
    expect(
      await horizontalOverflow(page),
      "la banda de KPI no puede meter scroll horizontal en la página",
    ).toBeLessThanOrEqual(0);
  });

  test("pulsar un KPI abre un unico panel operacional", async ({ page }) => {
    test.skip(!mutationsAllowed, "Crear un usuario toca la base: E2E_ALLOW_MUTATIONS=true.");

    await openPosAsCashier(page);

    await page.getByTestId("pos-kpi-ready").click();

    const panel = page.getByTestId("pos-operational-panel");
    await expect(panel).toHaveCount(1);
    await expect(panel).toBeVisible();

    // El panel es un `dialog` con el título del modo como nombre accesible y como encabezado visible.
    await expect(page.getByRole("dialog", { name: "Listos para entregar" })).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Listos para entregar" })).toBeVisible();

    // Lo que el panel trae para operar: la búsqueda por número y su cierre.
    await expect(panel.getByLabel("Buscar pedido")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Cerrar panel" })).toBeVisible();

    /*
      **Un solo panel para los cuatro modos.** Abrir otro contador cambia el modo del **mismo** componente:
      si apareciera un segundo `data-testid="pos-operational-panel"` (o quedara el anterior montado), el
      cajero tendría cuatro modales superpuestos —la deuda `A-92`— y el toque lo recibiría otro.
    */
    await page.getByTestId("pos-kpi-pending-payment").click();
    await expect(page.getByTestId("pos-operational-panel")).toHaveCount(1);
    await expect(panel.getByRole("heading", { name: "Por cobrar" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Listos para entregar" })).toHaveCount(0);

    // Y se cierra: el panel se monta sólo mientras está abierto.
    await page.getByRole("button", { name: "Cerrar panel" }).click();
    await expect(page.getByTestId("pos-operational-panel")).toHaveCount(0);
  });

  test("el panel operacional filtra por numero de pedido", async ({ page }) => {
    test.skip(!mutationsAllowed, "Crear un usuario toca la base: E2E_ALLOW_MUTATIONS=true.");

    await openPosAsCashier(page);

    const feed = await readOperationalFeed(page, await readPosLocationId(page));

    /*
      Se abre el modo con **más** filas (según el resumen del servidor): es el que hace que el filtro tenga
      algo que sacar. Si el local no tiene ninguno, el caso verifica igual lo que importa del vacío —que un
      filtro sin coincidencias **no es un error**—.
    */
    const modo = KPI_ENTRIES.map((entry) => ({
      id: entry.id,
      count: feed.summary[entry.summaryKey],
    })).reduce((max, entry) => (entry.count > max.count ? entry : max));

    await page.getByTestId(modo.id).click();

    const panel = page.getByTestId("pos-operational-panel");
    await expect(panel).toBeVisible();

    const filas = panel.getByTestId("pos-operational-row");
    const antes = await filas.count();

    if (modo.count > 0) {
      expect(antes, "el modo con pedidos tiene que dibujar sus filas").toBeGreaterThan(0);
    }

    // Un número de pedido que no existe no puede devolver filas: la búsqueda filtra, no adivina.
    await panel.getByLabel("Buscar pedido").fill(`ZZZ-NO-EXISTE-${Date.now()}`);
    await expect(filas).toHaveCount(0);

    // Y buscarlos no es un error: se dice sin alerta y sin el aviso de lectura fallida de la banda.
    await expect(page.getByText("No se pudieron leer los pedidos del local.")).toHaveCount(0);
    await expect(panel.getByRole("alert")).toHaveCount(0);

    if (antes > 0) {
      await expect(panel.getByText("Ningún pedido coincide con la búsqueda.")).toBeVisible();
    }
  });

  test("el landing del cajero es el POS", async ({ page }) => {
    test.skip(!mutationsAllowed, "Crear un usuario toca la base: E2E_ALLOW_MUTATIONS=true.");

    // Se entra con la cuenta de cajero y **no se navega a ningún lado**: lo que se mide es dónde la dejó el
    // login. Antes de la orden 6 aterrizaba en `/admin/orders` (el listado administrativo).
    await createCashierAndLogin(page);

    await expect(page).toHaveURL(/\/admin\/pos$/);
    await expect(page.getByRole("heading", { level: 1, name: "POS" })).toBeVisible();
    // Y su mostrador está listo para operar: la venta en curso es el panel con el que el cajero cobra
    // (`admin-cashier.spec.ts:61`, la misma señal de «el POS está dibujado» que usa el caso del rol).
    await expect(page.getByRole("dialog", { name: "Venta en curso" })).toBeVisible();
  });

  test("el pedido existente se abre inmutable desde ?orderId=", async ({ page }) => {
    // Lectura pura: la sesión del entorno alcanza y no se toca la base.
    await loginAsOwner(page);
    await page.goto("/admin/pos");
    await expect(page.getByRole("heading", { level: 1, name: "POS" })).toBeVisible();

    const feed = await readOperationalFeed(page, await readPosLocationId(page));
    // Un pedido listo es el caso más rico (tiene badge de producción y el CTA de su estado); si no hay,
    // sirve cualquiera del feed operacional.
    const candidato =
      feed.orders.find((order) => order.status === "ready_for_pickup") ?? feed.orders[0];

    if (!candidato) {
      test.skip(true, "no hay ningún pedido operativo en el local para abrirlo desde el POS");
      return;
    }

    await page.goto(`/admin/pos?orderId=${encodeURIComponent(candidato.id)}`);

    const panel = page.getByTestId("pos-existing-order-panel");
    await expect(panel).toBeVisible();

    // El pedido que se abrió es **ese**: su número y su cliente.
    await expect(panel).toContainText(candidato.orderNumber);
    await expect(panel).toContainText(candidato.customerName);

    // Los dos ejes de estado son independientes (producción y financiero) y se muestran separados.
    await expect(panel.getByText(/LISTO|PREPARANDO|NUEVO|CONFIRMADO|ACEPTADO/).first()).toBeVisible();
    await expect(panel.getByText(/PENDIENTE DE PAGO|PAGADO|POR COBRAR|PARCIAL|REVISAR/).first()).toBeVisible();

    // Los tres montos del pedido existente: total, lo cobrado y lo que falta.
    for (const monto of [/^Total\b/, /Pagado/, /Pendiente/]) {
      await expect(panel.getByText(monto).first()).toBeVisible();
    }

    /*
      **Inmutable**: el modo del pedido existente no vende. No hay alta de productos ni catálogo —agregar una
      línea sería armar una segunda `Order` sobre un pedido que ya existe y ya tiene sus precios congelados—.
    */
    await expect(panel.getByRole("button", { name: /agregar/i })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Catálogo" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Agregar .+ a la venta$/ })).toHaveCount(0);
    await expect(page.locator('[aria-label="Productos del local"]')).toHaveCount(0);

    // Y la acción que corresponde a su estado (criterios del brief): `ready+paid → Entregar`,
    // `ready+pending → Cobrar`. La expectativa sale del estado que **reportó el servidor**.
    if (candidato.status === "ready_for_pickup" && candidato.financialState.status === "paid") {
      await expect(panel.getByRole("button", { name: /^Entregar/i })).toBeVisible();
    }

    if (candidato.status === "ready_for_pickup" && candidato.financialState.status === "pending") {
      await expect(panel.getByRole("button", { name: /^Cobrar/i })).toBeVisible();
    }
  });

  test("el POS no tiene scroll horizontal en los cuatro viewports del contrato", async ({ page }) => {
    // Lectura pura: la sesión del entorno alcanza.
    await loginAsOwner(page);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/admin/pos");
      await expect(page.getByRole("heading", { level: 1, name: "POS" })).toBeVisible();

      // La banda del contrato: los cuatro contadores siguen visibles y accesibles en los cuatro viewports.
      for (const id of KPI_TEST_IDS) {
        await expect(page.getByTestId(id), `el contador ${id} no está a la vista`).toBeVisible();
      }

      // El scroll horizontal de la página es **cero**: lo que scrollea (los chips, el catálogo) scrollea
      // adentro de su panel.
      expect(
        await horizontalOverflow(page),
        `la página del POS desborda a lo ancho a ${viewport.width}×${viewport.height}`,
      ).toBeLessThanOrEqual(0);
    }
  });

  test("un cobro con overpayment partido se rechaza sin cambios financieros", async ({ page }) => {
    test.skip(!mutationsAllowed, "Crear un usuario toca la base: E2E_ALLOW_MUTATIONS=true.");

    await openPosAsCashier(page);
    const locationId = await readPosLocationId(page);
    const feed = await readOperationalFeed(page, locationId);

    const candidato = pickChargeableOrder(feed);

    if (!candidato) {
      test.skip(
        true,
        "no hay ningún pedido con saldo pendiente y sin montos sin resolver en el local: el POS no puede abrir un cobro normal",
      );
      return;
    }

    // El cobro exige turno abierto (`register-order-payment.ts:187`): se deja la caja lista antes de abrir el
    // pedido, para que lo que se mida sea el rechazo por el saldo y no la falta de caja.
    expect(
      await ensureOpenShift(page, locationId),
      "el arnés tiene que poder dejar una caja abierta: sin turno el POS no cobra",
    ).toBe(true);

    await page.goto(`/admin/pos?orderId=${encodeURIComponent(candidato.id)}`);

    const panel = page.getByTestId("pos-existing-order-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(candidato.orderNumber);

    const cobrar = panel.getByRole("button", { name: /^Cobrar/i });
    await expect(cobrar).toBeVisible();

    // El saldo es el que produjo `payments` (moneda base): con ese número se arma el sobrepago, no con uno
    // inventado por el test.
    const saldo = candidato.financialState.outstandingAmount;
    expect(saldo, "el caso necesita un saldo real que pasar").toBeGreaterThan(0);

    const filas = panel.getByLabel("Con cuánto paga", { exact: true });
    await expect(filas).toHaveCount(1);
    await filas.first().fill(String(saldo));

    // El cobro partido: una fila con el saldo y otra con un peso más. La suma **pasa** el saldo.
    await panel.getByRole("button", { name: "Partir el cobro" }).click();
    await expect(filas).toHaveCount(2);
    await filas.nth(1).fill("1");

    /*
      Si el medio configurado de alguna fila pide referencia, el servidor la exige **antes** de mirar el monto
      (`payment-composition.ts:157-164`). Se completa para que lo que el caso mida sea el rechazo por el saldo
      y no un campo vacío de otro eje.
    */
    const referencias = panel.getByLabel("Referencia del cobro");
    for (let index = 0; index < (await referencias.count()); index += 1) {
      await referencias.nth(index).fill("E2E-SOBREPAGO");
    }

    await cobrar.click();

    // 1) El rechazo se dice en pantalla, en español y hablando del saldo: el error del servidor nombra el
    //    problema (`register-order-payment.ts:376-380`), no un «monto inválido» que deja al cajero sin saber
    //    qué corregir.
    const error = panel.getByRole("alert").first();
    await expect(error).toBeVisible();
    await expect(error).toHaveText(/saldo|supera|pasa|falta/i);

    // 2) El checkout sigue abierto con lo que el cajero cargó: no hay confirmación de un cobro que no pasó.
    await expect(panel).toBeVisible();
    await expect(filas).toHaveCount(2);

    // 3) Y **no hay hecho financiero nuevo**: el mismo servidor que produce el estado canónico sigue
    //    reportando el mismo saldo (invariante 1: ni menos —no existe el abono comercial— ni más).
    const despues = await readOperationalFeed(page, locationId);
    const mismo = despues.orders.find((order) => order.id === candidato.id);
    expect(mismo, "el pedido tiene que seguir en el feed operacional del local").toBeTruthy();
    expect(mismo!.financialState.paidAmount).toBe(candidato.financialState.paidAmount);
    expect(mismo!.financialState.outstandingAmount).toBe(candidato.financialState.outstandingAmount);
    expect(mismo!.financialState.status).toBe(candidato.financialState.status);
  });
});
