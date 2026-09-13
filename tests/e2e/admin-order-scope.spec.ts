import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN_PASSWORD,
  E2E_ADMIN_EMAIL,
  addSeedProductToCart,
  loginAsOwner,
  logoutAdmin,
  mutationsAllowed,
} from "./helpers";

/**
 * A — el alcance por sucursal del staff, de punta a punta.
 *
 * Lo que pidió el owner: cada usuario ve **sus** sucursales y el dueño ve todas. Se prueba en el
 * navegador real porque es donde se cruzan las dos mitades del cambio: la API acota la lista y la
 * pantalla refleja ese alcance (`meta.locationIds`), y abrir por URL un pedido de otra sucursal
 * queda rechazado con un mensaje que se lee.
 *
 * El pedido de prueba vive en la sucursal de prueba: por la regla de T8 un local con pedidos no se
 * puede borrar, así que al final el test **la apaga** con el toggle de un toque (A). La sucursal se
 * reutiliza si ya existe, así la corrida es repetible.
 */
const BRANCH = "Sucursal E2E Alcance";
const BRANCH_SLUG = "sucursal-e2e-alcance";
const CUSTOMER_BRANCH = "Cliente Alcance Sucursal";
const CUSTOMER_MAIN = "Cliente Alcance Principal";
const KITCHEN_PASSWORD = "Cocina1234!";
/**
 * Nombre y correo **únicos por corrida**: el botón de revocar se identifica por el nombre, así que
 * dos corridas con el mismo nombre dejarían dos botones iguales (y Playwright, con razón, no elige
 * uno solo). La limpieza del final es best-effort: si el test se corta antes, la próxima corrida
 * usa otro nombre y no choca con el residuo.
 */
const STAMP = Date.now();
const KITCHEN_NAME = `Cocina Alcance ${STAMP}`;
const KITCHEN_EMAIL = `alcance-cocina-${STAMP}@example.com`;
const AGENT_NAME = `Agente Alcance ${STAMP}`;
const AGENT_EMAIL = `alcance-agente-${STAMP}@example.com`;

/** Asegura que la sucursal de prueba exista y esté **activa** (la reusa si ya está). */
async function ensureBranch(page: Page) {
  await page.goto("/admin/locations");
  await expect(page.getByText("Cargando locales…")).toBeHidden();

  if ((await page.getByRole("button", { name: `Editar local ${BRANCH}` }).count()) > 0) {
    const activate = page.getByRole("button", { name: `Activar ${BRANCH}` });
    if ((await activate.count()) > 0) {
      await activate.click();
      await expect(page.getByText("Local activado.")).toBeVisible();
    }
    return;
  }

  await page.getByRole("button", { name: "Nuevo local" }).click();
  await page.getByLabel("Nombre").fill(BRANCH);
  await page.getByLabel("Identificador para la URL").fill(BRANCH_SLUG);
  await page.getByLabel("Ciudad").fill("Diriamba");
  await page.getByRole("button", { name: "Crear local" }).click();
  await expect(page.getByText("Local creado.")).toBeVisible();
}

/** Apaga la sucursal de prueba con el toggle de un toque. */
async function disableBranch(page: Page) {
  await page.goto("/admin/locations");
  const apagar = page.getByRole("button", { name: `Apagar ${BRANCH}` });

  if ((await apagar.count()) === 0) return;

  await apagar.click();
  await expect(page.getByText("Local apagado.")).toBeVisible();
}

/** Confirma un pedido por la UI; sin `branch` va al local por defecto (el principal). */
async function placeOrder(page: Page, customerName: string, branch?: string) {
  await addSeedProductToCart(page);
  await page.goto("/checkout");

  if (branch) {
    await page.getByRole("radio", { name: new RegExp(branch) }).check();
  }

  await page.locator('input[name="customerName"]').fill(customerName);
  await page.locator('input[name="customerWhatsapp"]').fill("88887733");
  await page.getByRole("button", { name: /Confirmar pedido/ }).click();
  await expect(page).toHaveURL(/\/success\/.+/);
}

/** Los identificadores de los pedidos de esta corrida, leídos de la API con la sesión del dueño. */
async function orderIdsByCustomer(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/admin/orders", { cache: "no-store" });
    const payload = (await response.json()) as {
      data: Array<{ id: string; customerName: string; locationName: string | null }>;
    };

    return payload.data.map((order) => ({
      id: order.id,
      customerName: order.customerName,
      locationName: order.locationName,
    }));
  });
}

async function createKitchen(
  page: Page,
  { name, email, assignedBranch }: { name: string; email: string; assignedBranch?: string },
) {
  await page.goto("/admin/users");
  await page.getByLabel("Nombre").fill(name);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(KITCHEN_PASSWORD);
  await page.getByLabel("Rol del nuevo usuario").selectOption("kitchen");

  if (assignedBranch) {
    await page
      .getByRole("group", { name: "Sucursales asignadas" })
      .getByRole("checkbox", { name: assignedBranch })
      .check();
  }

  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText("Usuario creado correctamente.")).toBeVisible();
}

/** El botón de revocar se identifica por el **nombre** del usuario, no por el correo. */
async function revokeUser(page: Page, name: string) {
  await page.goto("/admin/users");
  const revoke = page.getByRole("button", { name: `Revocar acceso de ${name}` });

  if ((await revoke.count()) === 0) return;

  page.once("dialog", (dialog) => void dialog.accept());
  await revoke.click();
  await expect(page.getByText("Acceso revocado.")).toBeVisible();
}

/**
 * Entra con otra cuenta. `logoutAdmin` primero: con una sesión activa, `/admin/login` redirige al
 * panel y el formulario no está (era el error que tapaba el resto del test). Y se espera la URL de
 * aterrizaje: el panel navega con el router del cliente, y sin esperar esa navegación el `goto`
 * siguiente puede quedar pisado por ella.
 */
async function logIn(page: Page, email: string, password: string) {
  await logoutAdmin(page);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin(?:\/orders)?$/);
}

test.describe("alcance por sucursal del staff (A)", () => {
  test.skip(!mutationsAllowed, "Admin mutations are disabled unless E2E_ALLOW_MUTATIONS=true.");
  test.use({ viewport: { width: 1280, height: 900 } });
  // El recorrido crea sucursal, dos pedidos, dos usuarios y entra y sale tres veces del panel:
  // el presupuesto por defecto (30 s) no alcanza y deja errores confusos en la limpieza.
  test.setTimeout(240_000);

  test("la cocina asignada ve solo su sucursal y no puede abrir la ajena ni por URL", async ({
    page,
  }) => {
    let mainOrderId: string;

    await loginAsOwner(page);

    // Estado conocido de partida: las cuentas de la corrida anterior, si quedaron.
    await revokeUser(page, KITCHEN_NAME);
    await revokeUser(page, AGENT_NAME);

    try {
      // 1) Sucursal de prueba y un pedido en cada sucursal (uno por local, cliente distinto).
      await ensureBranch(page);
      await placeOrder(page, CUSTOMER_BRANCH, BRANCH);
      await placeOrder(page, CUSTOMER_MAIN);

      const orders = await orderIdsByCustomer(page);
      mainOrderId = orders.find((order) => order.customerName === CUSTOMER_MAIN)?.id ?? "";
      expect(mainOrderId, "el pedido del principal tiene que existir").not.toBe("");

      // 2) Una cocina asignada **solo** a la sucursal de prueba.
      await createKitchen(page, { name: KITCHEN_NAME, email: KITCHEN_EMAIL, assignedBranch: BRANCH });
      await expect(
        page.getByRole("article").filter({ hasText: KITCHEN_EMAIL }),
      ).toContainText(`Asignado a: ${BRANCH}`);

      // 3) Como cocina acotada: ve su pedido y no el del principal.
      await logIn(page, KITCHEN_EMAIL, KITCHEN_PASSWORD);
      await expect(page).toHaveURL(/\/admin\/orders$/);

      await page.getByRole("button", { name: "Mostrar filtros" }).click();
      // Una sola sucursal en el alcance: no hay nada que filtrar y el control no se dibuja.
      await expect(page.getByLabel("Local")).toHaveCount(0);

      await expect(
        page.getByRole("link", { name: /Abrir orden/ }).filter({ hasText: CUSTOMER_BRANCH }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Abrir orden/ }).filter({ hasText: CUSTOMER_MAIN }),
      ).toHaveCount(0);

      // 4) Ni por URL directa: el detalle explica por qué no se puede ver.
      await page.goto(`/admin/orders/${mainOrderId}`);
      await expect(page.getByText(/de otra sucursal/)).toBeVisible();

      // 5) El dueño sigue viendo las dos sucursales.
      await logIn(page, E2E_ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto("/admin/orders");
      await expect(
        page.getByRole("link", { name: /Abrir orden/ }).filter({ hasText: CUSTOMER_MAIN }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Abrir orden/ }).filter({ hasText: CUSTOMER_BRANCH }).first(),
      ).toBeVisible();

      // 6) Un usuario **sin asignar** ve todas: el admin lo dice explícito.
      await createKitchen(page, { name: AGENT_NAME, email: AGENT_EMAIL });
      await expect(
        page.getByRole("article").filter({ hasText: AGENT_EMAIL }),
      ).toContainText("Sin asignar · ve todas");
    } finally {
      // Limpieza: se lleva las cuentas de la corrida y deja la sucursal apagada. Best-effort: si
      // algo de arriba falló, esto no debe tapar el error real del test.
      try {
        await revokeUser(page, KITCHEN_NAME);
        await revokeUser(page, AGENT_NAME);
      } catch {
        // La próxima corrida vuelve a intentar borrarlas al empezar.
      }

      try {
        await loginAsOwner(page);
        await disableBranch(page);
      } catch {
        // La sucursal se reutiliza y se apaga en la próxima corrida.
      }
    }
  });
});
