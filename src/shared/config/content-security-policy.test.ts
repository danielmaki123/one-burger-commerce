import { describe, expect, it } from "vitest";

import {
  CONTENT_SECURITY_POLICY_HEADER,
  CSP_NONCE_REQUEST_HEADER,
  buildContentSecurityPolicy,
  createCspNonce,
} from "@/shared/config/content-security-policy";

/**
 * CSP del sitio.
 *
 * El proyecto no tenía ninguna: solo HSTS, `nosniff`, `X-Frame-Options` y compañía.
 * Esta política cierra las dos cosas que esos headers no cubren: **qué scripts pueden
 * ejecutarse** (con un nonce por respuesta, así un `<script>` inyectado no corre) y a
 * dónde puede conectarse o embeber la página.
 */
describe("createCspNonce", () => {
  it("no repite el nonce entre respuestas", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createCspNonce()));

    expect(nonces.size).toBe(50);
  });

  it("es base64 sin caracteres que rompan el header", () => {
    const nonce = createCspNonce();

    expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(nonce.length).toBeGreaterThanOrEqual(16);
  });
});

describe("buildContentSecurityPolicy", () => {
  const policy = buildContentSecurityPolicy("NONCE123");

  it("solo deja correr scripts con el nonce de la respuesta", () => {
    expect(policy).toContain("script-src 'self' 'nonce-NONCE123' 'strict-dynamic'");
  });

  it("cierra lo que no se usa: objetos, base y formularios ajenos", () => {
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'self'");
    expect(policy).toContain("default-src 'self'");
  });

  it("permite lo que el sitio realmente necesita", () => {
    // Las fotos del menú y del hero las carga el owner por URL: pueden ser de
    // cualquier host https.
    expect(policy).toContain("img-src 'self' data: blob: https:");
    // Las tipografías las sirve el propio build; el service worker es propio.
    expect(policy).toContain("font-src 'self' data:");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("worker-src 'self'");
    expect(policy).toContain("manifest-src 'self'");
  });

  it("no promete un upgrade a https que rompería el servidor local", () => {
    // `upgrade-insecure-requests` reescribe los subrecursos a https: contra
    // `http://127.0.0.1` eso deja la app sin CSS ni JS. El upgrade lo hace HSTS.
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("viaja como un solo header, sin saltos de línea", () => {
    expect(policy).not.toMatch(/[\r\n]/);
    expect(policy.split(";").length).toBeGreaterThanOrEqual(9);
  });
});

describe("constantes del header", () => {
  it("el nonce viaja al render en su propio header de request", () => {
    expect(CSP_NONCE_REQUEST_HEADER).toBe("x-nonce");
    expect(CONTENT_SECURITY_POLICY_HEADER).toBe("Content-Security-Policy");
  });
});
