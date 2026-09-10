import { beforeEach, describe, expect, it } from "vitest";

import {
  classifyHost,
  normalizeHost,
  resolveAdminAppUrl,
  resolveHostRoute,
  resolveMenuAppUrl,
} from "@/shared/config/host-routing";

/**
 * Estas variables cambian el ruteo, así que cada test arranca sin ninguna: si no,
 * un test contamina al siguiente.
 */
beforeEach(() => {
  delete process.env.MENU_APP_URL;
  delete process.env.ADMIN_APP_URL;
  delete process.env.ADMIN_HOSTS;
});

describe("classifyHost", () => {
  it("reconoce el apex y el www como el host de marca", () => {
    expect(classifyHost("oneburgernic.com")).toBe("brand");
    expect(classifyHost("www.oneburgernic.com")).toBe("brand");
  });

  it("reconoce los subdominios de menu y admin", () => {
    expect(classifyHost("menu.oneburgernic.com")).toBe("menu");
    expect(classifyHost("admin.oneburgernic.com")).toBe("admin");
  });

  it("deja fuera a localhost, las IPs y el host por defecto de Easypanel", () => {
    expect(classifyHost("localhost:3000")).toBe("other");
    expect(classifyHost("127.0.0.1:3210")).toBe("other");
    expect(classifyHost("brunobot-oneburguerweb.2jcsgw.easypanel.host")).toBe("other");
    expect(classifyHost(null)).toBe("other");
    expect(classifyHost("")).toBe("other");
  });

  it("acepta hosts admin extra por variable de entorno", () => {
    process.env.ADMIN_HOSTS = "panel.oneburger.example";

    try {
      expect(classifyHost("panel.oneburger.example")).toBe("admin");
    } finally {
      delete process.env.ADMIN_HOSTS;
    }
  });

  it("no se confunde con un dominio parecido", () => {
    expect(classifyHost("admin-oneburger.com")).toBe("brand");
    expect(classifyHost("menu.example.com")).toBe("menu");
  });
});

describe("normalizeHost", () => {
  it("saca el puerto, el primer host de una lista y las mayusculas", () => {
    expect(normalizeHost("OneBurger.com:443")).toBe("oneburger.com");
    expect(normalizeHost("a.com, b.com")).toBe("a.com");
    expect(normalizeHost("  ")).toBeNull();
  });
});

describe("resolveMenuAppUrl / resolveAdminAppUrl", () => {
  it("deriva el subdominio de menu desde el apex", () => {
    expect(resolveMenuAppUrl("oneburgernic.com")).toBe("https://menu.oneburgernic.com");
    expect(resolveMenuAppUrl("www.oneburgernic.com")).toBe("https://menu.oneburgernic.com");
  });

  it("deriva el subdominio de admin desde el apex", () => {
    expect(resolveAdminAppUrl("oneburgernic.com")).toBe("https://admin.oneburgernic.com");
  });

  it("no devuelve subdominio cuando ya estamos en el host de destino", () => {
    expect(resolveMenuAppUrl("menu.oneburgernic.com")).toBeNull();
    expect(resolveAdminAppUrl("admin.oneburgernic.com")).toBeNull();
  });

  it("no inventa subdominios en local ni en el host de Easypanel", () => {
    expect(resolveMenuAppUrl("localhost:3210")).toBeNull();
    expect(resolveMenuAppUrl("brunobot-oneburguerweb.2jcsgw.easypanel.host")).toBeNull();
  });

  it("la variable de entorno gana sobre la derivacion", () => {
    process.env.MENU_APP_URL = "https://pedidos.otrodominio.com/";

    expect(resolveMenuAppUrl("oneburgernic.com")).toBe("https://pedidos.otrodominio.com");
  });
});

describe("resolveHostRoute", () => {
  it("sirve el landing en la raiz del host de marca", () => {
    expect(resolveHostRoute({ host: "oneburgernic.com", pathname: "/" })).toEqual({
      action: "rewrite",
      pathname: "/landing",
    });
    expect(resolveHostRoute({ host: "www.oneburgernic.com", pathname: "/" })).toEqual({
      action: "rewrite",
      pathname: "/landing",
    });
  });

  it("deja intacta la app de pedidos en el host de menu y en local", () => {
    for (const host of ["menu.oneburgernic.com", "localhost:3210", "127.0.0.1:3210"]) {
      for (const pathname of ["/", "/menu", "/cart", "/checkout"]) {
        expect(resolveHostRoute({ host, pathname })).toEqual({ action: "next" });
      }
    }
  });

  it("lleva la raiz del host admin a /admin", () => {
    expect(resolveHostRoute({ host: "admin.oneburgernic.com", pathname: "/" })).toEqual({
      action: "redirect",
      pathname: "/admin",
    });
  });

  it("manda el resto del apex a la app de pedidos, conservando el path y el query", () => {
    expect(
      resolveHostRoute({
        host: "oneburgernic.com",
        pathname: "/cart",
        search: "?cupon=PROMO",
      }),
    ).toEqual({
      action: "redirectAbsolute",
      url: "https://menu.oneburgernic.com/cart?cupon=PROMO",
    });
  });

  it("manda el admin del apex y del menu al host de admin", () => {
    expect(resolveHostRoute({ host: "oneburgernic.com", pathname: "/admin/orders" })).toEqual({
      action: "redirectAbsolute",
      url: "https://admin.oneburgernic.com/admin/orders",
    });
    expect(resolveHostRoute({ host: "menu.oneburgernic.com", pathname: "/admin" })).toEqual({
      action: "redirectAbsolute",
      url: "https://admin.oneburgernic.com/admin",
    });
  });

  it("el host admin solo sirve el panel: el resto va a la app de pedidos", () => {
    expect(resolveHostRoute({ host: "admin.oneburgernic.com", pathname: "/admin/orders" })).toEqual({
      action: "next",
    });
    expect(resolveHostRoute({ host: "admin.oneburgernic.com", pathname: "/checkout" })).toEqual({
      action: "redirectAbsolute",
      url: "https://menu.oneburgernic.com/checkout",
    });
  });

  it("nunca redirige assets ni la propia ruta del landing", () => {
    const assetCases = [
      "/landing/frames/burger_0045.webp",
      "/brand/one-burger-mark.svg",
      "/manifest.webmanifest",
      "/sw.js",
      "/_next/static/chunk.js",
      "/landing",
    ];

    for (const pathname of assetCases) {
      expect(resolveHostRoute({ host: "oneburgernic.com", pathname })).toEqual({ action: "next" });
      expect(resolveHostRoute({ host: "admin.oneburgernic.com", pathname })).toEqual({
        action: "next",
      });
    }
  });

  it("se queda en el host cuando no puede deducir el subdominio", () => {
    // En local o en el host de la plataforma no hay a donde redirigir.
    expect(resolveHostRoute({ host: "localhost:3210", pathname: "/admin" })).toEqual({
      action: "next",
    });
    expect(
      resolveHostRoute({
        host: "brunobot-oneburguerweb.2jcsgw.easypanel.host",
        pathname: "/cart",
      }),
    ).toEqual({ action: "next" });
  });

  it("respeta MENU_APP_URL y ADMIN_APP_URL cuando estan seteadas", () => {
    process.env.MENU_APP_URL = "https://pedidos.example.com";
    process.env.ADMIN_APP_URL = "https://panel.example.com";

    try {
      expect(resolveHostRoute({ host: "oneburgernic.com", pathname: "/cart" })).toEqual({
        action: "redirectAbsolute",
        url: "https://pedidos.example.com/cart",
      });
      expect(resolveHostRoute({ host: "menu.oneburgernic.com", pathname: "/admin" })).toEqual({
        action: "redirectAbsolute",
        url: "https://panel.example.com/admin",
      });
    } finally {
      delete process.env.MENU_APP_URL;
      delete process.env.ADMIN_APP_URL;
    }
  });
});
