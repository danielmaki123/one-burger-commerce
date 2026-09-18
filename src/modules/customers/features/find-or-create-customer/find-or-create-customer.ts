import { PrismaCustomerAuthRepository } from "@/modules/customers/adapters/prisma-customer-auth-repository";
import { resolveCustomerFiscalData } from "@/modules/customers/domain/customer-fiscal-data";
import { maskWhatsapp } from "@/modules/customers/domain/mask-whatsapp";
import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";

type CustomerLinkRepository = Pick<
  CustomerAuthRepository,
  | "findCustomerByWhatsapp"
  | "createCustomer"
  | "updateCustomerFullName"
  | "updateCustomerFiscalData"
>;

type FindOrCreateCustomerInput = {
  fullName: string;
  whatsappNormalized: string;
  /**
   * Punto 4 del roadmap (2026-09-18) — los datos fiscales que el cliente dio para su factura. Llegan
   * **sin normalizar**: `resolveCustomerFiscalData` decide si sirven (los dos o ninguno).
   */
  taxId?: string | null;
  legalName?: string | null;
};

type FindOrCreateCustomerDependencies = {
  repository?: CustomerLinkRepository;
  logger?: Pick<Console, "warn">;
};

function normalizeName(fullName: string) {
  const normalized = fullName.trim();
  return normalized.length > 0 ? normalized : null;
}

function isUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeCode = (error as { code?: unknown }).code;
  return maybeCode === "P2002";
}

function warnAutoLink(
  logger: Pick<Console, "warn">,
  reason: string,
  whatsappNormalized: string,
) {
  logger.warn(
    `[customer-auto-link] ${reason} whatsapp=${maskWhatsapp(whatsappNormalized)}`,
  );
}

export async function findOrCreateCustomer(
  input: FindOrCreateCustomerInput,
  dependencies: FindOrCreateCustomerDependencies = {},
) {
  const repository =
    dependencies.repository ?? new PrismaCustomerAuthRepository();
  const logger = dependencies.logger ?? console;
  const normalizedName = normalizeName(input.fullName);
  /**
   * Punto 4 — los datos fiscales se resuelven **antes** de tocar la base: media factura no se guarda y el
   * cliente que no pidió factura no pierde el RUC que dio la vez anterior.
   */
  const fiscal = resolveCustomerFiscalData({ taxId: input.taxId, legalName: input.legalName });

  try {
    let customer = await repository.findCustomerByWhatsapp(
      input.whatsappNormalized,
    );

    if (!customer) {
      try {
        const created = await repository.createCustomer({
          whatsappNormalized: input.whatsappNormalized,
          fullName: normalizedName,
        });

        return await saveFiscalData(created.id, fiscal, repository, logger, input.whatsappNormalized);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          customer = await repository.findCustomerByWhatsapp(
            input.whatsappNormalized,
          );
          if (!customer) {
            warnAutoLink(
              logger,
              "conflict_without_customer_after_race",
              input.whatsappNormalized,
            );
            return null;
          }
        } else {
          warnAutoLink(
            logger,
            "create_customer_failed",
            input.whatsappNormalized,
          );
          return null;
        }
      }
    }

    if (!customer) {
      return null;
    }

    const saved = await saveFiscalData(
      customer.id,
      fiscal,
      repository,
      logger,
      input.whatsappNormalized,
    );

    if (normalizedName && !customer.fullName?.trim()) {
      try {
        const updated = await repository.updateCustomerFullName(
          customer.id,
          normalizedName,
        );
        return updated.id;
      } catch {
        warnAutoLink(
          logger,
          "update_customer_full_name_failed",
          input.whatsappNormalized,
        );
        return saved;
      }
    }

    return saved;
  } catch {
    warnAutoLink(logger, "auto_link_failed", input.whatsappNormalized);
    return null;
  }
}

/**
 * Punto 4 — guardar los datos fiscales del cliente, si los dio completos.
 *
 * **No hace fallar la venta**: la factura es un dato del cliente, no el cobro. Si el guardado fiscal falla
 * se avisa en el log y se sigue con el id del cliente, que es lo que el pedido necesita.
 */
async function saveFiscalData(
  customerId: string,
  fiscal: { taxId: string | null; legalName: string | null },
  repository: CustomerLinkRepository,
  logger: Pick<Console, "warn">,
  whatsappNormalized: string,
): Promise<string> {
  if (!fiscal.taxId || !fiscal.legalName) return customerId;

  try {
    const updated = await repository.updateCustomerFiscalData(customerId, {
      taxId: fiscal.taxId,
      legalName: fiscal.legalName,
    });
    return updated.id;
  } catch {
    warnAutoLink(logger, "update_customer_fiscal_data_failed", whatsappNormalized);
    return customerId;
  }
}
