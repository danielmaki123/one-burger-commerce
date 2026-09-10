import { beforeEach, describe, expect, it } from "vitest";

import {
  classifyHost,
  normalizeHost,
  resolveAdminAppUrl,
  resolveHostRoute,
  resolveMenuAppUrl,
} from "@/shared/config/host-routing";

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
  beforeEach(() => {
    delete process.env.MENU_APP_URL;
    delete process.env.ADMIN_APP_URL;
  });

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
    expect(resolveHostRoute({ host: "menu.oneburgernic.com", pathname: "/" })).toEqual({
      action: "next",
    });
    expect(resolveHostRoute({ host: "localhost:3210", pathname: "/" })).toEqual({
      action: "next",
    });
    expect(resolveHostRoute({ host: "oneburgernic.com", pathname: "/menu" })).toEqual({
      action: "next",
    });
  });

  it("lleva la raiz del host admin a /admin", () => {
    expect(resolveHostRoute({ host: "admin.oneburgernic.com", pathname: "/" })).toEqual({
      action: "redirect",
      pathname: "/admin",
    });
  });
});
