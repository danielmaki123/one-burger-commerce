import { expect, test, type Page } from "@playwright/test";

import { loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * Fase 6 del rediseño de Caja (2026-09-23) — **terminal por turno**, de punta a punta.
 *
 * El caso que importa de la fase y que ninguna unidad puede probar entero: un local con **dos POS**
 * (mostrador y barra) abre **las dos cajas a la vez**, se cobra en una y **cada cierre arquea solo su
 * plata**. Sin el arqueo por turno, la caja que no vendió nada habría "esperado" también la venta de la otra
 * (la lectura por ventana de tiempo del local): este spec es el que caza eso en un navegador real.
 *
 * Deja el estado ordenado: las dos terminales del E2E quedan **apagadas** al final. Es importante de verdad:
 * con terminales activas, abrir la caja exige elegir una, y los specs que abren por API (`admin-cash.spec.ts`
 * y `admin-pos.spec.ts`) no la mandan — se romperían por datos del test, no por un producto roto.
 */

const CAJA = "E2E Caja 1";
const BARRA = "E2E Barra";

test.describe("terminal por turno", () => {
  test("dos cajas abiertas en el mismo local: se cobra en una y cada cierre arquea su plata", async ({
    page,
  }) => {
    test.skip(!mutationsAllowed, "Cargar terminales y cobrar tocan la base: E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);
    await ensureTerminals(page);

    // 1. Las dos cajas abiertas al mismo tiempo (antes de la Fase 6 el segundo turno rebotaba).
    await page.goto("/admin/cash");
    await openCaja(page, CAJA);
    await openCaja(page, BARRA);

    const shifts = await page.evaluate(async (labels) => {
      const locations = (
        (await (await fetch("/api/admin/locations", { cache: "no-store" })).json()) as {
          data: Array<{ id: string }>;
        }
      ).data;
      const locationId = locations[0]!.id;

      const terminals = (
        (await (
          await fetch(`/api/admin/cash/terminals?locationId=${encodeURIComponent(locationId)}`, {
            cache: "no-store",
          })
        ).json()) as { data: { terminals: Array<{ id: string; label: string }> } }
      ).data.terminals;

      const found: Record<string, string> = {};

      for (const label of labels) {
        const terminal = terminals.find((candidate) => candidate.label === label);
        if (!terminal) continue;

        const shift = (
          (await (
            await fetch(
              `/api/admin/pos/shift?locationId=${encodeURIComponent(locationId)}&terminalId=${encodeURIComponent(terminal.id)}`,
              { cache: "no-store" },
            )
          ).json()) as { data?: { id: string } | null }
        ).data;

        if (shift) found[label] = shift.id;
      }

      return found;
    }, [CAJA, BARRA]);

    expect(Object.keys(shifts), "las dos cajas quedaron abiertas").toHaveLength(2);

    // 2. Se cobra **en la barra**: una venta en efectivo por el total que muestra el POS.
    await page.goto("/admin/pos");
    await page.getByLabel("Terminal").selectOption({ label: BARRA });
    await page.getByRole("button", { name: /^Agregar .+ a la venta$/ }).first().click();

    const etiqueta = await page.getByRole("button", { name: /^Cobrar C\$/ }).textContent();
    const total = Number((etiqueta ?? "").replace(/[^\d.]/g, ""));
    expect(total).toBeGreaterThan(0);

    await page.getByLabel("Nombre del cliente").fill("Cliente terminal E2E");
    // El WhatsApp es un control compuesto (prefijo + número) y en este flujo necesita teclearse: con `fill`
    // el número quedaba en el placeholder y el botón de cobrar seguía apagado (el cobro no tenía cliente).
    await page.getByLabel("Número del cliente").click();
    await page.getByLabel("Número del cliente").pressSequentially("88887777");
    await expect(page.getByLabel("Número del cliente")).toHaveValue("88887777");
    await page.getByLabel("Con cuánto paga").fill(String(total));
    await page.getByRole("button", { name: /^Cobrar C\$/ }).click();
    await expect(page.getByRole("status")).toContainText("Venta P-");

    // 3. Se cierra **la caja del mostrador**, que no vendió nada.
    await page.goto("/admin/cash");
    await closeCaja(page, CAJA);

    const mostrador = await readShift(page, shifts[CAJA]!);
    const barra = await readShift(page, shifts[BARRA]!);

    // El mostrador arquea **solo su cajón**: fondo 0 y ninguna venta. Con el arqueo por ventana de tiempo
    // (lo de antes de la Fase 6) acá habría aparecido la venta de la barra.
    expect(mostrador.status).toBe("closed");
    expect(mostrador.expectedAmount).toBe(0);

    // Y la barra sigue abierta, con su venta en su propio esperado.
    expect(barra.status).toBe("open");

    // 4. Se cierra la barra: su esperado es la venta que cobró, no la del local.
    await closeCaja(page, BARRA);

    const barraCerrada = await readShift(page, shifts[BARRA]!);

    expect(barraCerrada.status).toBe("closed");
    expect(barraCerrada.expectedAmount).toBe(total);

    // 5. Se dejan las terminales apagadas (los specs que abren la caja por API no mandan terminal).
    await ensureTerminals(page, { apagar: true });
  });
});

/** Alta idempotente de las dos terminales del E2E (y su apagado al final). */
async function ensureTerminals(page: Page, options: { apagar?: boolean } = {}) {
  await page.goto("/admin/cash/config");
  const section = page.getByRole("region", { name: "Terminales" });
  await expect(section).toBeVisible();

  const rows = section.getByLabel(/^Nombre de la terminal \d+$/);
  const labels = [CAJA, BARRA];

  for (const label of labels) {
    const existing = await findRowIndex(rows, label);

    if (existing >= 0) {
      const activa = section.getByLabel(`${label} activa`);
      await (options.apagar ? activa.uncheck() : activa.check());
      continue;
    }

    // No está: se crea (y al final del spec se apaga, no se borra).
    await section.getByRole("button", { name: "Agregar terminal" }).click();
    const index = (await rows.count()) - 1;
    await rows.nth(index).fill(label);
    await section.getByRole("button", { name: "Guardar terminales" }).click();
    await expect(section.getByText("Terminales guardadas.")).toBeVisible();

    if (options.apagar) {
      const activa = section.getByLabel(`${label} activa`);
      await activa.uncheck();
    }
  }

  await section.getByRole("button", { name: "Guardar terminales" }).click();
  await expect(section.getByText("Terminales guardadas.")).toBeVisible();
}

async function findRowIndex(
  rows: ReturnType<Page["getByLabel"]>,
  label: string,
): Promise<number> {
  for (let index = 0; index < (await rows.count()); index += 1) {
    if ((await rows.nth(index).inputValue()) === label) return index;
  }

  return -1;
}

/**
 * Abre la caja de esa terminal (si ya está abierta, no hace nada).
 *
 * El `selectOption` **no** dispara un cambio cuando la terminal ya está elegida, así que la pantalla puede
 * estar todavía resolviendo el estado del turno: hay que esperar a que aparezca una de las dos acciones antes
 * de decidir. Sin esa espera el «Abrir caja» se saltea (el botón no está en el DOM mientras carga) y el
 * cierre después falla por falta de caja.
 */
async function openCaja(page: Page, terminalLabel: string) {
  await page.getByLabel("Terminal").selectOption({ label: terminalLabel });

  const abrir = page.getByRole("button", { name: "Abrir caja" });
  const cerrar = page.getByRole("button", { name: "Cerrar caja" });
  await expect(abrir.or(cerrar).first()).toBeVisible();

  if (await abrir.isVisible()) {
    await abrir.click();
  }

  await expect(page.getByText(/Caja abierta desde/)).toBeVisible();
}

/**
 * Cierra la caja de esa terminal: el conteo y el cuadre viven en el modal.
 *
 * Se cierra **contando** (un billete) a propósito: el cierre contado es el que deja `closingAmount`, y hay un
 * spec viejo (`admin-cash.spec.ts`, «la hoja de cierre...») que busca un turno cerrado **con conteo** para
 * imprimir su hoja. Sin esto, en una base recién creada ese caso no encuentra ninguno y falla por datos.
 */
async function closeCaja(page: Page, terminalLabel: string) {
  await page.getByLabel("Terminal").selectOption({ label: terminalLabel });
  await expect(page.getByText(/Caja abierta desde/)).toBeVisible();

  await page.getByRole("button", { name: "Cerrar caja" }).click();

  const dialog = page.getByRole("dialog");
  // `exact` porque «NIO 100» también matchea «NIO 1000» (Playwright busca por substring).
  await dialog
    .getByRole("spinbutton", { name: "Cantidad de billetes de NIO 100", exact: true })
    .fill("1");
  await dialog.getByRole("button", { name: "Cerrar caja" }).click();
  await expect(page.getByText("Cierre registrado")).toBeVisible();
}

/** El turno tal como quedó guardado (los números congelados del cierre). */
async function readShift(page: Page, shiftId: string) {
  return page.evaluate(async (id) => {
    const shift = (
      (await (
        await fetch(`/api/admin/cash/shifts/${encodeURIComponent(id)}`, { cache: "no-store" })
      ).json()) as { data: { status: string; expectedAmount: number | null } }
    ).data;

    return { status: shift.status, expectedAmount: shift.expectedAmount };
  }, shiftId);
}
