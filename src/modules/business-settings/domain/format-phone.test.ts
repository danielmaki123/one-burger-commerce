import { describe, expect, it } from "vitest";

import { formatPhoneForDisplay } from "@/modules/business-settings/domain/format-phone";

describe("formatPhoneForDisplay", () => {
  it("agrupa el teléfono por defecto como lo muestra el sitio", () => {
    expect(formatPhoneForDisplay("+50588770888")).toBe("+505 8877 0888");
  });

  it("ignora espacios y guiones del valor guardado", () => {
    expect(formatPhoneForDisplay(" +505-8877-0888 ")).toBe("+505 8877 0888");
  });

  it("aplica el mismo agrupado a cualquier país de 3 dígitos con 8 de número", () => {
    expect(formatPhoneForDisplay("+34600123456")).toBe("+346 0012 3456");
  });

  it("devuelve el valor tal cual cuando no tiene el formato esperado", () => {
    expect(formatPhoneForDisplay("+5058877088")).toBe("+5058877088");
    expect(formatPhoneForDisplay("12345")).toBe("12345");
  });

  it("no rompe con nulo o vacío", () => {
    expect(formatPhoneForDisplay(null)).toBeNull();
    expect(formatPhoneForDisplay("   ")).toBeNull();
  });
});
