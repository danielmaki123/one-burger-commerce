import { expect, test } from "@playwright/test";

import { loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * Bloque 1 del roadmap del POS (Fase 2) — Caja del día y el detalle de un cierre.
 *
 * Estos dos casos existen por un motivo concreto: la pantalla de detalle es un **server component**
 * que muestra datos guardados, y esa clase de página puede compilar sin errores y fallar en runtime
 * (pasó en este mismo bloque: un `onChange` que cruzaba al cliente hacía 500 al abrir el detalle, y ni
 * `next build` ni `build:webpack` lo detectan). Un navegador real abriendo la URL es la única
 * verificación que lo cubre.
 */

/** Un id de turno del primer local con caja, por API (no se asume cuántos turnos hay). */
async function firstShiftId(page: import("@playwright/test").Page): Promise<string | null> {
  return page.evaluate(async () => {
    const locationsResponse = await fetch("/api/admin/locations", { cache: "no-store" });
    const locationsPayload = await locationsResponse.json();
    const locations = locationsPayload.data ?? [];

    for (const location of locations) {
      const shiftsResponse = await fetch(
        `/api/admin/cash/shifts?locationId=${encodeURIComponent(location.id)}`,
        { cache: "no-store" },
      );
      const shiftsPayload = await shiftsResponse.json();

      if (shiftsPayload.data?.length) return shiftsPayload.data[0].id;
    }

    return null;
  });
}

/** Un turno **cerrado** con arqueo: es el único que tiene hoja de cierre que firmar (13.3). */
async function closedShiftId(page: import("@playwright/test").Page): Promise<string | null> {
  return page.evaluate(async () => {
    const locationsResponse = await fetch("/api/admin/locations", { cache: "no-store" });
    const locations = (await locationsResponse.json()).data ?? [];

    for (const location of locations) {
      const shiftsResponse = await fetch(
        `/api/admin/cash/shifts?locationId=${encodeURIComponent(location.id)}`,
        { cache: "no-store" },
      );
      const shifts = (await shiftsResponse.json()).data ?? [];
      const closed = shifts.find(
        (shift: { status: string; closingAmount: number | null }) =>
          shift.status === "closed" && shift.closingAmount !== null,
      );

      if (closed) return closed.id as string;
    }

    return null;
  });
}

test.describe("caja del día", () => {
  test("el historial lista los turnos y no tiene scroll horizontal a 375 px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsOwner(page);
    await page.goto("/admin/cash");

    await expect(page.getByRole("heading", { name: "Caja del día" })).toBeVisible();
    await expect(page.getByText(/Leyendo el historial de caja…/)).toBeHidden({ timeout: 20_000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("el cierre del día consolida las sucursales (11.5/11.6)", async ({ page }) => {
    await loginAsOwner(page);

    // El panel es un server component que lee **todas** las sucursales del alcance: si fallara al
    // resolver el día del negocio o el repositorio, la pantalla no se dibujaría.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/cash");

    const cierreDelDia = page.getByRole("region", { name: "Cierre del día" });
    await expect(cierreDelDia).toBeVisible();
    await expect(cierreDelDia.getByRole("heading", { name: "Cierre del día" })).toBeVisible();

    // 11.6: la comparación, una fila por sucursal. Se muestra siempre (una sucursal sin turnos va con
    // ceros), así que la comparación no desaparece justo el día que nadie vendió.
    const comparacion = cierreDelDia.getByRole("list", { name: "Comparación por sucursal" });
    await expect(comparacion).toBeVisible();
    await expect(comparacion.getByRole("listitem").first()).toContainText("Efectivo");

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(cierreDelDia).toBeVisible();
    await expect(page.getByText("A server error occurred")).toHaveCount(0);
  });

  test("el detalle de un cierre se abre con su arqueo y su conteo", async ({ page }) => {
    await loginAsOwner(page);
    const shiftId = await firstShiftId(page);
    expect(shiftId, "la base local tiene al menos un turno").toBeTruthy();

    await page.goto(`/admin/cash/history/${shiftId}`);

    await expect(page.getByRole("region", { name: "Arqueo del cierre" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Conteo por moneda" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Esperado por moneda" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Movimientos de caja" })).toBeVisible();
    // Un 500 de Next muestra este texto: es el caso que este spec vino a atrapar.
    await expect(page.getByText("A server error occurred")).toHaveCount(0);
  });

  /**
   * Bloque 2 del roadmap del POS (Fase 2) — un movimiento de caja entra al arqueo.
   *
   * El caso registra un **retiro** sobre la caja abierta (abriéndola si hace falta) y comprueba que:
   * la API lo guarda, el historial del detalle lo muestra y el esperado del cierre lo **descuenta**.
   * Es el agujero que este bloque vino a cerrar: sin movimientos, sacar plata para el proveedor
   * parecía un faltante del cajero.
   */
  test("un retiro se registra, se ve en el historial y baja el esperado", async ({ page }) => {
    test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);

    const shiftId = await page.evaluate(async () => {
      const locationsResponse = await fetch("/api/admin/locations", { cache: "no-store" });
      const locations = (await locationsResponse.json()).data ?? [];

      for (const location of locations) {
        const openResponse = await fetch(
          `/api/admin/pos/shift?locationId=${encodeURIComponent(location.id)}`,
          { cache: "no-store" },
        );
        const open = (await openResponse.json()).data;
        if (open) return open.id as string;

        const created = await fetch("/api/admin/pos/shift/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId: location.id, counts: [] }),
        });
        const body = await created.json();
        if (created.ok) return body.data.id as string;
      }

      return null;
    });

    expect(shiftId, "hay una caja abierta (o se abrió una)").toBeTruthy();

    const created = await page.evaluate(async (id) => {
      const response = await fetch(`/api/admin/cash/shifts/${id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "withdrawal",
          category: "supplier",
          amount: 250,
          currency: "NIO",
          reason: "Retiro E2E para el proveedor",
        }),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, shiftId);

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      kind: "withdrawal",
      amount: 250,
      reason: "Retiro E2E para el proveedor",
    });

    await page.goto(`/admin/cash/history/${shiftId}`);
    const movimientos = page.getByRole("region", { name: "Movimientos de caja" });
    // `first()`: la base local acumula corridas y el motivo se repite; lo que se afirma es que el
    // movimiento que se acaba de registrar está en el historial.
    await expect(movimientos.getByText("Retiro E2E para el proveedor").first()).toBeVisible();
    await expect(movimientos.getByText("−C$250.00").first()).toBeVisible();
    await expect(
      page.getByText(/Movimientos del turno \(retiros restan, ingresos suman\)/),
    ).toBeVisible();
  });

  /**
   * Bloque 13.3 del roadmap del POS (Fase 2) — la hoja de cierre que se imprime y se firma.
   *
   * El cierre de caja es el único documento del turno que termina firmado: el papel tiene que decir el
   * arqueo y **quién cierra**, con nombre. El nombre se lee de la cabecera de la pantalla y se compara
   * con el que sale en la hoja: si la pantalla y el papel dijeran cosas distintas, el que firma no
   * sabría qué firmó. Se imprime en una ventana nueva (la del sistema, sin dependencias).
   */
  test("la hoja de cierre se imprime con el nombre de quien cierra", async ({ page }) => {
    await loginAsOwner(page);

    const shiftId = await closedShiftId(page);
    expect(shiftId, "la base local tiene un turno cerrado con arqueo").toBeTruthy();

    await page.goto(`/admin/cash/history/${shiftId}`);

    // 375 px: las tres acciones de la cabecera tienen que **envolver**, no salirse de la pantalla.
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole("button", { name: "Imprimir cierre" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 1280, height: 900 });

    const descripcion = await page.getByText(/· cerró /).first().textContent();
    const nombre = descripcion?.split("cerró")[1]?.trim();
    expect(nombre, "el cierre tiene un responsable con nombre").toBeTruthy();
    // Una firma con «—» no la firma nadie: la pantalla tiene el nombre del usuario que cerró.
    expect(nombre).not.toBe("—");

    const [hoja] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("button", { name: "Imprimir cierre" }).click(),
    ]);
    await hoja.waitForLoadState("domcontentloaded");

    const texto = (await hoja.locator("pre").textContent()) ?? "";

    expect(texto).toContain("CIERRE DE CAJA");
    expect(texto).toContain(`Cerró: ${nombre}`);
    expect(texto).toContain("Firma: ___");
    // Un 500 de Next en el detalle mostraría esto: el spec vino a atrapar esa clase de fallo.
    await expect(page.getByText("A server error occurred")).toHaveCount(0);
  });

  /**
   * Tarea 1.5 del roadmap (2026-09-17) — el **reporte diario de caja**.
   *
   * El resumen del día que había era de órdenes; este dice la plata de la caja: total cobrado, por dónde
   * entró, propinas y cómo quedó cada sucursal. Se comprueba en navegador real que la pantalla abra, que el
   * día se pueda cambiar por la URL (formulario GET, sin JavaScript) y que no meta scroll horizontal.
   */
  test("el reporte del día muestra la caja y se puede cambiar de fecha", async ({ page }) => {
    await loginAsOwner(page);

    await page.goto("/admin/cash/report");
    const panel = page.getByRole("region", { name: "Reporte de caja del día" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Total cobrado")).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 900 });

    // El día viaja por la URL: se pide uno anterior y el encabezado del panel lo refleja.
    await panel.getByLabel("Día").fill("2026-09-10");
    await panel.getByRole("button", { name: "Ver el día" }).click();

    await expect(page).toHaveURL(/date=2026-09-10/);
    await expect(page.getByRole("region", { name: "Reporte de caja del día" })).toBeVisible();
  });

  /**
   * Tarea 7 del brief (2026-09-17) — el **corte X** y el **traspaso de caja** (1.12 y 1.13).
   *
   * Dos cosas que solo se pueden verificar en un navegador real: que el corte se **imprima** sin cerrar
   * la caja (con su aclaración, para que nadie lo confunda con un cierre) y que el traspaso se firme con
   * el nombre de quien recibe y quede en el historial del turno. El esperado del papel lo calcula el
   * servidor; acá se comprueba que llegue al papel y a la lista.
   */
  test("el corte X se imprime sin cerrar la caja y el traspaso queda firmado", async ({ page }) => {
    test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);

    const shift = await page.evaluate(async () => {
      const locations = (await (await fetch("/api/admin/locations", { cache: "no-store" })).json())
        .data ?? [];

      for (const location of locations) {
        const open = (
          await (
            await fetch(`/api/admin/pos/shift?locationId=${encodeURIComponent(location.id)}`, {
              cache: "no-store",
            })
          ).json()
        ).data;

        if (open) return { id: open.id as string, locationId: location.id as string };

        const created = await fetch("/api/admin/pos/shift/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId: location.id, counts: [] }),
        });

        if (created.ok) {
          const body = await created.json();
          return { id: body.data.id as string, locationId: location.id as string };
        }
      }

      return null;
    });

    expect(shift, "hay una caja abierta (o se abrió una)").toBeTruthy();

    await page.goto("/admin/cash");
    const panel = page.getByRole("region", { name: "Corte y traspaso de caja" });
    await expect(panel).toBeVisible();

    // 375 px: el panel nuevo no puede meter scroll horizontal (regla del sistema).
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 900 });

    const [corte] = await Promise.all([
      page.waitForEvent("popup"),
      panel.getByRole("button", { name: "Imprimir corte X" }).click(),
    ]);
    await corte.waitForLoadState("domcontentloaded");

    const papelCorte = (await corte.locator("pre").textContent()) ?? "";
    expect(papelCorte).toContain("CORTE X");
    expect(papelCorte).toContain("Esperado: C$");
    // El papel aclara que el turno sigue abierto: un corte confundido con un cierre deja la caja abierta.
    expect(papelCorte).toContain("NO cierra la caja");
    await corte.close();

    const recibe = `Carlos Ruiz ${Date.now()}`;
    await panel.getByLabel("Recibe la caja").fill(recibe);

    const [traspaso] = await Promise.all([
      page.waitForEvent("popup"),
      panel.getByRole("button", { name: "Firmar traspaso" }).click(),
    ]);
    await traspaso.waitForLoadState("domcontentloaded");

    const papelTraspaso = (await traspaso.locator("pre").textContent()) ?? "";
    expect(papelTraspaso).toContain("TRASPASO DE CAJA (CORTE X)");
    expect(papelTraspaso).toContain(`Recibe: ${recibe}`);
    // Las dos firmas: el que entrega y el que recibe (si no, no hay traspaso que valga).
    expect(papelTraspaso.match(/Firma: ___/g) ?? []).toHaveLength(2);
    await traspaso.close();

    await expect(panel.getByText(`Traspaso registrado · recibe ${recibe}`)).toBeVisible();
    await expect(panel.getByText(new RegExp(`Recibió ${recibe}`))).toBeVisible();

    // Y queda en el turno: el detalle del cierre lo va a mostrar también después de cerrar la caja.
    await page.goto(`/admin/cash/history/${shift!.id}`);
    const historial = page.getByRole("region", { name: "Traspasos de caja" });
    await expect(historial.getByText(new RegExp(`Recibió ${recibe}`))).toBeVisible();
  });
});
