import { PrismaCustomerAuthRepository } from "@/modules/customers/adapters/prisma-customer-auth-repository";
import { maskWhatsapp } from "@/modules/customers/domain/mask-whatsapp";
import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";

type CustomerLinkRepository = Pick<
  CustomerAuthRepository,
  "findCustomerByWhatsapp" | "createCustomer" | "updateCustomerFullName"
>;

type FindOrCreateCustomerInput = {
  fullName: string;
  whatsappNormalized: string;
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

        return created.id;
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
        return customer.id;
      }
    }

    return customer.id;
  } catch {
    warnAutoLink(logger, "auto_link_failed", input.whatsappNormalized);
    return null;
  }
}
