import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LANDING_FRAMES_VERSION } from "@/modules/landing/domain/landing-frames";

/**
 * Contrato de caché de los frames del landing.
 *
 * Pesan 3,26 MB. Sin una cabecera propia, Next sirve `public/` con `max-age=0` y
 * un ETag derivado de la fecha del archivo, así que **cada deploy obligaba a
 * todos los clientes a volver a bajarlos**. Este test evita que se pierda.
 */
const repoRoot = path.resolve(__dirname, "../../..");

describe("caché de los frames del landing", () => {
  it("declara caché inmutable para los frames", () => {
    const config = readFileSync(path.join(repoRoot, "next.config.ts"), "utf8");

    expect(config).toContain('source: "/landing/frames/:path*"');
    expect(config).toContain("public, max-age=31536000, immutable");
  });

  it("versiona la URL, así subir un frame nuevo no queda tapado por la caché", () => {
    expect(LANDING_FRAMES_VERSION).toMatch(/^\d+$/);
  });
});
