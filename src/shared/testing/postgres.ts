import { getPrismaClient } from "@/infrastructure/database/prisma";

/**
 * TASK-AUD-004 — arnés de **PostgreSQL real** para los tests que no se pueden demostrar con un doble.
 *
 * Regla del repo (`AGENTS.md` § *Datos, migraciones y dinero*): una propiedad que dependa de la base
 * —atomicidad, unique constraint, lock, carrera, rollback, *partial write*— se prueba contra PostgreSQL
 * **real**. Un repositorio en memoria no puede fallar como falla la base, así que no puede demostrar nada
 * de eso.
 *
 * Cómo se corre:
 *
 * ```bash
 * DATABASE_URL="postgresql://…" npm run test:postgres
 * ```
 *
 * La base tiene que estar **migrada** (`npx prisma migrate deploy`) y ser **de test**: cada archivo la vacía.
 * Los archivos `*.postgres.test.ts` **no** entran en `npm test`: el job que los corre es el de CI que ya
 * tiene PostgreSQL levantado (`migrations`), igual que el gate de páginas vive dentro de `verify`. Si
 * `DATABASE_URL` falta, el arnés **falla fuerte** en vez de saltearse: un test que se saltea solo es un
 * test que no existe.
 */

/** La URL de la base de test, o un error que dice exactamente qué hacer. */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "Los tests *.postgres.test.ts necesitan DATABASE_URL apuntando a una base de PostgreSQL real " +
        "(con las migraciones aplicadas). En CI los corre el job `migrations`, que ya la tiene; en local: " +
        "levantá PostgreSQL, creá una base de test, aplicá `npx prisma migrate deploy` y exportá " +
        "DATABASE_URL con esa base antes de `npm run test:postgres`.",
    );
  }

  return url;
}

/**
 * Vacía todas las tablas del esquema `public` (menos `_prisma_migrations`), para que cada test arranque
 * de un estado conocido.
 *
 * `TRUNCATE` en una sola sentencia y con `CASCADE` respeta las claves foráneas sin apagar constraints, y
 * `RESTART IDENTITY` deja las secuencias en cero: dos corridas no se pisan.
 */
export async function resetDatabase(): Promise<void> {
  const prisma = getPrismaClient();

  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  const tables = rows.map((row) => `"public"."${row.tablename}"`);

  if (tables.length === 0) {
    throw new Error(
      "no hay tablas en la base de test: aplicá las migraciones (`npx prisma migrate deploy`) antes de correr los tests de PostgreSQL",
    );
  }

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
}

/** Cierra el cliente para que vitest no quede colgado con la conexión abierta. */
export async function closeDatabase(): Promise<void> {
  await getPrismaClient().$disconnect();
}
