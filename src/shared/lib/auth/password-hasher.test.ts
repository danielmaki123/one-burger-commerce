import { scryptSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  SCRYPT_PARAMS,
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from "@/shared/lib/auth/password-hasher";

/**
 * Endurecimiento del hash de contraseñas.
 *
 * El hash viejo era `salt:digest` con los parámetros por defecto de Node (N=2^14,
 * r=8, p=1, ~51 ms medidos acá). Este endurecimiento sube el costo y, sobre todo,
 * **guarda los parámetros dentro del hash**, así se pueden subir de nuevo más
 * adelante sin romper las cuentas que ya existen.
 */
function legacyHash(password: string, salt = "aabbccddeeff00112233445566778899"): string {
  // Es exactamente lo que hacía la versión anterior: sin parámetros, defaults de Node.
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function hashWith(params: { N: number; r: number; p: number; keylen?: number }, password: string) {
  const keylen = params.keylen ?? SCRYPT_PARAMS.keylen;
  const salt = "00112233445566778899aabbccddeeff";
  const digest = scryptSync(password, salt, keylen, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 512 * 1024 * 1024,
  }).toString("hex");

  return `scrypt$${params.N}$${params.r}$${params.p}$${salt}$${digest}`;
}

describe("hashPassword", () => {
  it("guarda los parámetros dentro del hash", () => {
    const hash = hashPassword("Admin1234!");

    expect(hash.startsWith(`scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$`)).toBe(
      true,
    );
    expect(hash.split("$")).toHaveLength(6);
  });

  it("usa un salt nuevo cada vez", () => {
    expect(hashPassword("Admin1234!")).not.toBe(hashPassword("Admin1234!"));
  });

  it("el costo sube de verdad respecto de los defaults viejos", () => {
    // El hash viejo usaba los defaults de Node; este tiene que ser más caro.
    expect(SCRYPT_PARAMS.N).toBeGreaterThan(16384);
    expect(SCRYPT_PARAMS.r).toBe(8);
    expect(SCRYPT_PARAMS.p).toBeGreaterThanOrEqual(2);
    // 128 * N * r bytes de memoria: el parámetro que decide el costo real.
    expect(128 * SCRYPT_PARAMS.N * SCRYPT_PARAMS.r).toBeGreaterThan(32 * 1024 * 1024);
  });
});

describe("verifyPassword", () => {
  it("acepta la contraseña correcta y rechaza la incorrecta", () => {
    const hash = hashPassword("Admin1234!");

    expect(verifyPassword("Admin1234!", hash)).toBe(true);
    expect(verifyPassword("admin1234!", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
  });

  it("sigue aceptando los hashes viejos, que no tienen parámetros guardados", () => {
    // Sin esto, el endurecimiento dejaría a todo el equipo afuera del admin.
    const legacy = legacyHash("Admin1234!");

    expect(verifyPassword("Admin1234!", legacy)).toBe(true);
    expect(verifyPassword("otra", legacy)).toBe(false);
  });

  it("un hash roto o de otro formato no rompe: devuelve false", () => {
    for (const broken of [
      "",
      "sin-separadores",
      "scrypt$65536$8$2$solo-cuatro-partes",
      "scrypt$0$0$0$aa$bb",
      "scrypt$65536$8$2$aa$zz",
      "$2b$10$abcdefghijklmnopqrstuv",
    ]) {
      expect(verifyPassword("Admin1234!", broken)).toBe(false);
    }
  });
});

describe("passwordNeedsRehash", () => {
  it("pide rehash para los hashes viejos", () => {
    expect(passwordNeedsRehash(legacyHash("Admin1234!"))).toBe(true);
  });

  it("no pide rehash para un hash con los parámetros de hoy", () => {
    expect(passwordNeedsRehash(hashPassword("Admin1234!"))).toBe(false);
  });

  it("pide rehash para parámetros más débiles", () => {
    expect(
      passwordNeedsRehash(hashWith({ N: 16384, r: 8, p: 1 }, "Admin1234!")),
    ).toBe(true);
    expect(passwordNeedsRehash(hashWith({ N: 65536, r: 8, p: 1 }, "Admin1234!"))).toBe(true);
    expect(
      passwordNeedsRehash(
        hashWith({ N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p, keylen: 32 }, "x"),
      ),
    ).toBe(true);
  });

  it("no debilita un hash más fuerte que el de hoy", () => {
    // Si alguien sube los parámetros en el seed y después se despliega un build viejo,
    // el rehash no puede bajar el costo.
    expect(
      passwordNeedsRehash(hashWith({ N: 131072, r: 8, p: 3 }, "Admin1234!")),
    ).toBe(false);
  });
});
