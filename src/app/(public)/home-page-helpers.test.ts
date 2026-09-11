import { describe, expect, it } from "vitest";

import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";

import {
  buildQuickAddCartItem,
  canQuickAddProduct,
  flattenHomeProducts,
  getHomeBrandNameClassName,
  getHomeHeroFrameClassName,
  getHomeHeroLoadingClassName,
  getHomeHeroTitleClassName,
  getHomePageShellClassName,
  getHomePickupEstimateLabel,
  getHomePopularCtaClassName,
  normalizeHomeHeroDescription,
  resolveHomeOpenState,
  searchHomeProducts,
} from "./home-page-helpers";

describe("public home helpers", () => {
  it("uses a wider desktop shell for the public home page", () => {
    const className = getHomePageShellClassName();

    expect(className).toContain("max-w-6xl");
    expect(className).toContain("gap-5");
    expect(className).toContain("pb-10");
    expect(className).toContain("pt-4");
  });

  it("caps the home hero with explicit heights instead of oversized aspect ratios", () => {
    const className = getHomeHeroFrameClassName();
    const loadingClassName = getHomeHeroLoadingClassName();

    expect(className).toContain("h-[320px]");
    expect(className).toContain("sm:h-[420px]");
    expect(className).toContain("lg:h-[460px]");
    expect(className).not.toContain("aspect-[4/5]");

    expect(loadingClassName).toContain("h-[320px]");
    expect(loadingClassName).toContain("sm:h-[420px]");
    expect(loadingClassName).toContain("lg:h-[460px]");
    expect(loadingClassName).not.toContain("aspect-[4/5]");
  });

  it("el título del hero usa la escala del mock, no tamaños sueltos", () => {
    const className = getHomeHeroTitleClassName();

    // T1.3: los tamaños pasaron a ser tokens (30 px mobile / 40 px escritorio,
    // peso 800 y su interlineado), así que ya no hay valores arbitrarios acá.
    expect(className).toContain("text-display");
    expect(className).toContain("lg:text-display-lg");
    expect(className).not.toMatch(/text-\[\d/);
    expect(className).not.toContain("font-semibold");
    expect(className).toContain("max-w-full");
    expect(className).toContain("break-words");
  });

  it("el nombre del negocio en el encabezado usa el paso headline del mock", () => {
    const className = getHomeBrandNameClassName();

    expect(className).toContain("text-headline");
    expect(className).toContain("text-ink-green");
    expect(className).not.toContain("font-semibold");
  });

  it("uses a tactile plus CTA size for home popular cards", () => {
    const className = getHomePopularCtaClassName();

    expect(className).toContain("h-11");
    expect(className).toContain("w-11");
  });

  it("corrects the audited public hero accent without mutating marketing data", () => {
    expect(normalizeHomeHeroDescription("Para disfrutar mas la mesa")).toBe(
      "Para disfrutar más la mesa",
    );
  });
});

/** `-06:00` es la zona de Managua, sin horario de verano. 2026-09-11 es viernes. */
function managua(isoDay: string, hhmm: string): Date {
  return new Date(`${isoDay}T${hhmm}:00-06:00`);
}

function hoursWith(overrides: Partial<BusinessHours["fri"]> = {}): BusinessHours {
  const day = { closed: false, open: "12:00", close: "22:00", ...overrides };

  return {
    mon: { ...day },
    tue: { ...day },
    wed: { ...day },
    thu: { ...day },
    fri: { ...day },
    sat: { ...day },
    sun: { ...day },
  };
}

describe("estado operativo de la home (T2)", () => {
  const base = {
    isAcceptingOrders: true,
    closedMessage: "Volvemos a las 12:00.",
    businessHours: hoursWith(),
    timezone: "America/Managua",
    pickupLeadMinutes: 25,
  };

  it("dice Abierto dentro del horario, con los pedidos activos", () => {
    expect(resolveHomeOpenState({ ...base, now: managua("2026-09-11", "19:00") })).toEqual({
      isOpen: true,
      label: "Abierto",
      detail: "hoy de 12:00 a 22:00",
    });
  });

  it("dice Cerrado fuera del horario y muestra a qué hora abre hoy", () => {
    expect(resolveHomeOpenState({ ...base, now: managua("2026-09-11", "08:00") })).toEqual({
      isOpen: false,
      label: "Cerrado",
      detail: "hoy de 12:00 a 22:00",
    });
  });

  it("dice Cerrado con el mensaje del negocio cuando los pedidos están pausados", () => {
    // El estado operativo no es solo el horario: si el owner pausó los pedidos,
    // el cartel tiene que decirlo, no mostrar que está abierto.
    expect(
      resolveHomeOpenState({
        ...base,
        isAcceptingOrders: false,
        now: managua("2026-09-11", "19:00"),
      }),
    ).toEqual({ isOpen: false, label: "Cerrado", detail: "Volvemos a las 12:00." });
  });

  it("sin mensaje configurado explica el cierre con el horario de hoy", () => {
    expect(
      resolveHomeOpenState({
        ...base,
        closedMessage: "   ",
        isAcceptingOrders: false,
        now: managua("2026-09-11", "19:00"),
      }).detail,
    ).toBe("hoy de 12:00 a 22:00");
  });

  it("un día cerrado se ve como cerrado y lo dice", () => {
    expect(
      resolveHomeOpenState({
        ...base,
        businessHours: hoursWith({ closed: true }),
        now: managua("2026-09-11", "19:00"),
      }),
    ).toEqual({ isOpen: false, label: "Cerrado", detail: "hoy cerrado" });
  });
});

describe("estimado de retiro de la home (T2)", () => {
  it("usa el tiempo de preparación configurado", () => {
    expect(getHomePickupEstimateLabel({ pickupLeadMinutes: 25 })).toBe("Retiro: ~25 min");
    expect(getHomePickupEstimateLabel({ pickupLeadMinutes: 5 })).toBe("Retiro: ~5 min");
  });

  it("sin tiempo de preparación no promete una espera que no existe", () => {
    expect(getHomePickupEstimateLabel({ pickupLeadMinutes: 0 })).toBe(
      "Retiro: lo antes posible",
    );
  });
});

describe("productos de la home (T2)", () => {
  type Product = {
    id: string;
    name: string;
    description: string | null;
    basePrice: number;
    images: { url: string; alt: string | null }[];
    availability?: { isAvailable: boolean; isActive: boolean };
  };

  function product(id: string, name: string, description: string | null = null) {
    return { id, name, description, basePrice: 30, images: [] } satisfies Product;
  }

  const birria = product("p1", "Taco de Birria", "Taco de res estilo Jalisco");
  const pastor = product("p2", "Taco de Pastor", "Cerdo marinado con achiote");
  const jamaica = product("p3", "Agua de Jamaica", "Bebida fría de flor de Jamaica");

  const categories = [
    {
      id: "c1",
      name: "Tacos",
      slug: "tacos",
      products: [birria],
      subcategories: [{ products: [pastor] }],
    },
    { id: "c2", name: "Bebidas", slug: "bebidas", products: [jamaica] },
  ];

  it("aplana categorías y subcategorías y etiqueta cada producto con la suya", () => {
    // El chip de la tarjeta del mock ("Top #1", "Guarnición") es copy fijo; acá
    // sale de los datos: la categoría del producto.
    expect(flattenHomeProducts(categories).map((item) => [item.id, item.categoryName])).toEqual([
      ["p1", "Tacos"],
      ["p2", "Tacos"],
      ["p3", "Bebidas"],
    ]);
  });

  it("deja afuera lo que no se puede pedir", () => {
    const unavailable = {
      ...product("p9", "Agotado"),
      availability: { isAvailable: false, isActive: true },
    };
    const inactive = {
      ...product("p10", "Inactivo"),
      availability: { isAvailable: true, isActive: false },
    };

    expect(
      flattenHomeProducts([
        { id: "c", name: "Tacos", slug: "tacos", products: [unavailable, inactive] },
      ]),
    ).toEqual([]);
  });

  it("no repite un producto que aparece en dos lugares del menú", () => {
    const flattened = flattenHomeProducts([
      { id: "c1", name: "Tacos", slug: "tacos", products: [birria] },
      { id: "c2", name: "Promos", slug: "promos", products: [birria] },
    ]);

    expect(flattened.map((item) => item.id)).toEqual(["p1"]);
  });

  it("busca sin acentos ni mayúsculas, por nombre y por descripción", () => {
    const flattened = flattenHomeProducts(categories);

    expect(searchHomeProducts(flattened, "BIRRIA").map((item) => item.id)).toEqual(["p1"]);
    expect(searchHomeProducts(flattened, "jamaica").map((item) => item.id)).toEqual(["p3"]);
    expect(searchHomeProducts(flattened, "achiote").map((item) => item.id)).toEqual(["p2"]);
    expect(searchHomeProducts(flattened, "   ")).toEqual([]);
    expect(searchHomeProducts(flattened, "sushi")).toEqual([]);
  });
});

describe("agregar al carrito desde la home (T2)", () => {
  it("se agrega directo cuando el producto no obliga a elegir nada", () => {
    expect(canQuickAddProduct({ modifierGroups: [] })).toBe(true);
    expect(canQuickAddProduct({})).toBe(true);
    expect(
      canQuickAddProduct({
        modifierGroups: [
          {
            isRequired: false,
            minSelections: 0,
            options: [{ priceDelta: 5, isActive: true }],
          },
        ],
      }),
    ).toBe(true);
  });

  it("no se agrega directo cuando hay que elegir", () => {
    expect(
      canQuickAddProduct({
        modifierGroups: [
          { isRequired: true, minSelections: 0, options: [{ isActive: true }] },
        ],
      }),
    ).toBe(false);
    expect(
      canQuickAddProduct({
        modifierGroups: [
          { isRequired: false, minSelections: 1, options: [{ isActive: true }] },
        ],
      }),
    ).toBe(false);
  });

  it("un grupo obligatorio sin opciones activas no bloquea: no habría nada que elegir", () => {
    expect(
      canQuickAddProduct({
        modifierGroups: [
          { isRequired: true, minSelections: 1, options: [{ isActive: false }] },
        ],
      }),
    ).toBe(true);
  });

  it("arma la línea del carrito con el precio y el empaque del producto", () => {
    expect(
      buildQuickAddCartItem({
        id: "p1",
        name: "Taco de Birria",
        description: null,
        basePrice: 35,
        packagingFeeAmount: 5,
        images: [{ url: "/taco.jpg", alt: "Taco", isPrimary: true }],
        availability: { isAvailable: true, isActive: true },
        categoryName: "Tacos",
        categorySlug: "tacos",
      }),
    ).toEqual({
      productId: "p1",
      productName: "Taco de Birria",
      imageUrl: "/taco.jpg",
      imageAlt: "Taco",
      quantity: 1,
      unitPrice: 35,
      packagingUnitAmount: 5,
      packagingTotalAmount: 5,
      modifierOptionIds: [],
      modifiers: [],
      lineTotal: 40,
    });
  });
});
