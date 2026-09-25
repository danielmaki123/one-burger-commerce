import { PrismaClient } from "@prisma/client";

/**
 * Cliente de base que acepta un adaptador: el cliente raíz **o** la transacción en curso.
 *
 * Es la misma lista de exclusiones con la que Prisma define `Prisma.TransactionClient` (un `tx` no puede
 * abrir otra transacción ni reconectarse), así que los dos tipos encajan y un repositorio puede recibir
 * cualquiera de los dos. Lo que **no** se puede hacer desde acá es anidar transacciones: los métodos que
 * abren la suya por lote (`$transaction([...])`) tienen que pedir el cliente raíz a propósito.
 */
export type DatabaseClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return globalForPrisma.prisma;
}
