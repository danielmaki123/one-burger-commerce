// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultBusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings-defaults";
import type { PublicLocation } from "@/modules/locations/features/list-public-locations/list-public-locations";
import { CartProvider, useCart } from "@/shared/lib/cart";
import {
  BusinessSettingsProvider,
  type BusinessSettingsValue,
} from "@/shared/lib/business-settings";

import PublicHomePage from "./page";

function settingsValue(overrides: Partial<BusinessSettingsValue> = {}): BusinessSettingsValue {
  const record = createDefaultBusinessSettingsRecord();

  return { ...record, updatedAt: record.updatedAt.toISOString(), ...overrides };
}

const MENU_PAYLOAD = {
  marketingBlocks: [],
  categories: [
    {
      id: "c1",
      name: "Tacos",
      slug: "tacos",
      products: [],
      subcategories: [
        {
          id: "s1",
          name: "Especiales",
          slug: "especiales",
          products: [
            {
              id: "seed-prod-01",
              name: "Taco de Birria",
              description: "Taco de res estilo Jalisco",
              basePrice: 35,
              packagingFeeAmount: 0,
              images: [],
              modifierGroups: [],
              availability: { isAvailable: true, isActive: true },
            },
            {
              id: "seed-prod-03",
              name: "Taco de Pastor",
              description: "Cerdo marinado con achiote",
              basePrice: 28,
              packagingFeeAmount: 0,
              images: [],
              modifierGroups: [
                {
                  id: "g1",
                  name: "Tipo de carne",
                  isRequired: true,
                  minSelections: 1,
                  maxSelections: 1,
                  options: [{ id: "o1", name: "Res", priceDelta: 0, isActive: true }],
                },
              ],
              availability: { isAvailable: true, isActive: true },
            },
          ],
        },
      ],
    },
    {
      id: "c2",
      name: "Bebidas",
      slug: "bebidas",
      products: [
        {
          id: "seed-prod-04",
          name: "Agua de Jamaica",
          description: "Bebida fría",
          basePrice: 18,
          packagingFeeAmount: 0,
          images: [],
          modifierGroups: [],
          availability: { isAvailable: false, isActive: true },
        },
      ],
      subcategories: [],
    },
  ],
};

function CartProbe() {
  const { items } = useCart();
  return <p>Carrito: {items.length}</p>;
}

/** Horario propio del local de prueba: distinto del que trae la configuración. */
const MENU_LOCATION_HOURS = {
  mon: { open: "09:00", close: "18:00", closed: false },
  tue: { open: "09:00", close: "18:00", closed: false },
  wed: { open: "09:00", close: "18:00", closed: false },
  thu: { open: "09:00", close: "18:00", closed: false },
  fri: { open: "09:00", close: "18:00", closed: false },
  sat: { open: "09:00", close: "18:00", closed: false },
  sun: { open: "09:00", close: "18:00", closed: false },
};

function renderHome(settings: BusinessSettingsValue = settingsValue()) {
  return render(
    <CartProvider>
      <BusinessSettingsProvider settings={settings}>
        <CartProbe />
        <PublicHomePage />
      </BusinessSettingsProvider>
    </CartProvider>,
  );
}

describe("home pública (T2)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(MENU_PAYLOAD) } as Response),
      ),
    );
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("muestra los productos que se pueden pedir, con su categoría, y esconde los agotados", async () => {
    renderHome();

    expect(await screen.findByText("Taco de Birria")).toBeTruthy();
    expect(screen.getByText("Taco de Pastor")).toBeTruthy();
    expect(screen.queryByText("Agua de Jamaica")).toBeNull();

    // El chip de la tarjeta sale de la categoría del producto.
    const card = screen.getByRole("link", { name: "Ver Taco de Birria" });
    const article = card.closest("article") as HTMLElement;
    expect(within(article).getByText("Tacos")).toBeTruthy();
    expect(within(article).getByText(/C\$/)).toBeTruthy();
  });

  it("el buscador filtra el menú que ya está cargado", async () => {
    const user = userEvent.setup();
    renderHome();
    await screen.findByText("Taco de Birria");

    await user.type(screen.getByLabelText("Buscar en el menú"), "pastor");

    expect(screen.getByText("Taco de Pastor")).toBeTruthy();
    expect(screen.queryByText("Taco de Birria")).toBeNull();

    await user.clear(screen.getByLabelText("Buscar en el menú"));
    await user.type(screen.getByLabelText("Buscar en el menú"), "sushi");

    // Sin resultados se explica y se ofrece limpiar, en vez de dejar la pantalla vacía.
    expect(screen.getByText(/No encontramos productos/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(screen.getByText("Taco de Birria")).toBeTruthy();
  });

  it("el '+' agrega al carrito de verdad y lo anuncia", async () => {
    const user = userEvent.setup();
    renderHome();
    await screen.findByText("Taco de Birria");

    expect(screen.getByText("Carrito: 0")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Agregar Taco de Birria al carrito" }));

    expect(screen.getByText("Carrito: 1")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Agregado al carrito");
  });

  it("cuando hay que elegir opciones la tarjeta lleva al producto, sin botón que mienta", async () => {
    renderHome();
    await screen.findByText("Taco de Pastor");

    expect(screen.queryByRole("button", { name: "Agregar Taco de Pastor al carrito" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ver Taco de Pastor" })).toHaveProperty(
      "pathname",
      "/menu/seed-prod-03",
    );
  });

  it("la información del restaurante usa los datos del admin y enlaces que funcionan", async () => {
    renderHome(
      settingsValue({
        addressLine: "Frente al parque central",
        city: "Jinotepe",
        mapsUrl: "https://maps.test/one-burger",
        phone: "+50588770888",
      }),
    );

    const directions = await screen.findByRole("link", { name: /Cómo llegar/ });
    expect(directions.getAttribute("href")).toBe("https://maps.test/one-burger");
    expect(screen.getByRole("link", { name: /Llamar/ }).getAttribute("href")).toBe(
      "tel:+50588770888",
    );
    expect(screen.getByText(/Frente al parque central, Jinotepe/)).toBeTruthy();
  });

  it("sin URL de mapas arma la búsqueda con la dirección configurada", async () => {
    renderHome(settingsValue({ mapsUrl: null, addressLine: "Frente al parque", city: "Jinotepe" }));

    const directions = await screen.findByRole("link", { name: /Cómo llegar/ });
    const href = directions.getAttribute("href") ?? "";

    expect(href).toContain("google.com/maps/search");
    expect(decodeURIComponent(href)).toContain("Frente al parque, Jinotepe");
  });

  it("sin dirección ni mapas no dibuja un botón que no lleve a ningún lado", async () => {
    renderHome(settingsValue({ mapsUrl: null, addressLine: null, city: null }));
    await screen.findByText("Información del restaurante");

    expect(screen.queryByRole("link", { name: /Cómo llegar/ })).toBeNull();
  });

  it("el estado operativo y el estimado salen de la configuración", async () => {
    renderHome(settingsValue({ pickupLeadMinutes: 25, isAcceptingOrders: false }));

    await screen.findByText("Información del restaurante");

    // Con los pedidos pausados el cartel no puede decir "Abierto".
    expect(screen.getByText("Cerrado")).toBeTruthy();
    expect(screen.getByText(/Retiro: ~25 min/)).toBeTruthy();
  });

  /**
   * T8 fase 7 — el cartel de la home mira el local, como el checkout y el servidor.
   *
   * La regla del servidor es por local desde la fase 6: si el cartel siguiera leyendo la
   * configuración del negocio, podría decir "Abierto" mientras el checkout rechaza el
   * pedido (o al revés).
   */
  it("el estado operativo sale del local por defecto cuando hay uno (T8)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const body = url.includes("/api/locations")
          ? {
              data: [
                {
                  id: "loc_norte",
                  name: "Sucursal Norte",
                  isAcceptingOrders: false,
                  closedMessage: "Hoy no abrimos en el Norte.",
                  businessHours: MENU_LOCATION_HOURS,
                  pickupLeadMinutes: 40,
                },
              ] satisfies Partial<PublicLocation>[],
            }
          : MENU_PAYLOAD;

        return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
      }),
    );

    // La configuración del negocio dice lo contrario: manda el local.
    renderHome(settingsValue({ pickupLeadMinutes: 25, isAcceptingOrders: true }));

    expect(await screen.findByText("Cerrado")).toBeTruthy();
    expect(screen.getByText(/Hoy no abrimos en el Norte\./)).toBeTruthy();
    expect(screen.getByText(/Retiro: ~40 min/)).toBeTruthy();
  });
});
