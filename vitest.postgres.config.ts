import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * TASK-AUD-004 — la corrida que sí puede fallar como falla la base.
 *
 * Sólo entran los `*.postgres.test.ts`: necesitan un PostgreSQL real y por eso **no** corren en
 * `npm run test` (el job `verify` no tiene base). Los corre el job `migrations` del CI, que ya levanta
 * PostgreSQL 17 y aplica las migraciones, o `npm run test:postgres` en local.
 *
 * El timeout es más alto que el de los unitarios: una carrera real necesita esperar a que dos
 * transacciones se pisen.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.postgres.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Una base por corrida: los tests de atomicidad y carrera no se pueden paralelizar entre archivos
    // sin que se pisen el estado.
    fileParallelism: false,
  },
});
