import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CheckoutPage, {
  CheckoutPickupPanel,
  CheckoutTablePanel,
  getGeoErrorMessage,
} from "./page";

let mockCart = {
  items: [] as Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    packagingUnitAmount?: number;
    packagingTotalAmount?: number;
    modifierOptionIds: string[];
    modifiers?: Array<{
      groupName: string;
      optionName: string;
      priceDelta: number;
    }>;
    notes?: string;
    lineTotal: number;
  }>,
  subtotal: 0,
  clearCart: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/shared/lib/cart", () => ({
  useCart: () => mockCart,
}));

describe("public checkout page", () => {
  beforeEach(() => {
    mockCart = {
      items: [],
      subtotal: 0,
      clearCart: vi.fn(),
    };
  });

  it("renders the refreshed empty checkout state", () => {
    const html = renderToStaticMarkup(createElement(CheckoutPage));

    expect(html).toContain("Tu carrito está vacío");
    expect(html).toContain("Agregá productos del menú para armar tu pedido.");
    expect(html).toContain("Ver menú");
  });

  it("uses accented public copy for geolocation errors", () => {
    expect(getGeoErrorMessage()).toBe(
      "No pudimos obtener tu ubicación. Volvé a intentarlo.",
    );
    expect(
      getGeoErrorMessage({
        code: 2,
        POSITION_UNAVAILABLE: 2,
      } as GeolocationPositionError),
    ).toBe("No pudimos obtener tu ubicación. Revisá GPS o señal y volvé a intentarlo.");
  });

  it("renders delivery checkout with the approved final-step copy", () => {
    mockCart = {
      items: [
        {
          productId: "prod-1",
          productName: "Sushirrito",
          quantity: 1,
          unitPrice: 585.95,
          packagingUnitAmount: 35,
          packagingTotalAmount: 35,
          modifierOptionIds: ["extra-shrimp"],
          modifiers: [
            {
              groupName: "Extras",
              optionName: "Agregar camarón tempura",
              priceDelta: 95,
            },
          ],
          notes: "Sin cebolla",
          lineTotal: 680.95,
        },
      ],
      subtotal: 680.95,
      clearCart: vi.fn(),
    };

    const html = renderToStaticMarkup(createElement(CheckoutPage));

    expect(html).not.toContain("Paso final");
    expect(html).toContain("Confirmá tu pedido");
    expect(html).not.toContain("Datos de entrega y resumen de tu pedido.");
    expect(html).toContain("Editar carrito");
    expect(html).toContain("Hora de retiro");
    expect(html).not.toContain("Delivery");
    expect(html).not.toContain("Mesa");
    expect(html).toContain("Tus datos");
    expect(html).toContain("Notas para retiro");
    expect(html).not.toContain("Zona");
    expect(html).not.toContain("Dirección de entrega");
    expect(html).not.toContain("Número de mesa");
    expect(html).toContain("Tu pedido");
    expect(html).toContain("Sushirrito");
    expect(html).toContain("Agregar camarón tempura");
    expect(html).toContain("Confirmar pedido");
    expect(html).toContain("Total a pagar");
    expect(html).not.toContain("GPS opcional");
    expect(html).not.toContain("Incluir propina 10%");
    expect(html).not.toContain("Elegí cómo querés recibirlo");
  });

  it("renders pickup checkout with chips and compact summary copy", () => {
    const html = renderToStaticMarkup(
      createElement(CheckoutPickupPanel, {
        customerName: "María López",
        customerWhatsapp: "88770888",
        pickupTime: "19:30",
        pickupNotes: "",
        totalLabel: "C$425.00",
        cartItemCount: 1,
        itemLine: "Sangría",
        itemMeta: "1x · Sangria de 1/2 Litro",
        onChange: vi.fn(),
        onSelectPickupTime: vi.fn(),
        onSubmit: vi.fn(),
        submitting: false,
        disabled: false,
      }),
    );

    expect(html).toContain("Confirmá tu pedido");
    expect(html).toContain("Hora de retiro");
    expect(html).toContain("Lo antes posible");
    expect(html).toContain("7:30 p. m.");
    expect(html).toContain("Notas para retiro");
    expect(html).toContain("1 item");
    expect(html).toContain("Listo para confirmar");
    expect(html).toContain("max-w-[11ch]");
    expect(html).toContain("leading-[1.04]");
    expect(html).not.toContain("GPS opcional");
    expect(html).not.toContain("Incluir propina 10%");
  });

  it("keeps the table panel unavailable from the full checkout MVP flow", () => {
    const html = renderToStaticMarkup(
      createElement(CheckoutTablePanel, {
        customerName: "María López",
        tableValue: "",
        kitchenNotes: "",
        tableOptions: [{ value: "table-12", label: "Mesa 12" }],
        tablesLoading: false,
        tablesError: null,
        itemLine: "Aperol Spritz",
        totalLabel: "C$290.00",
        onChangeName: vi.fn(),
        onChangeTable: vi.fn(),
        onChangeNotes: vi.fn(),
        onSubmit: vi.fn(),
        submitting: false,
        disabled: false,
      }),
    );

    expect(html).toContain("Agregá tu nombre y número de mesa.");
    expect(html).toContain("Aperol Spritz");
    expect(html).toContain("Total a pagar");
    expect(html).not.toContain("GPS opcional");
    expect(html).not.toContain("Incluir propina 10%");
  });
});
