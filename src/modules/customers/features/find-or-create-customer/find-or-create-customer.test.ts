import { describe, expect, it, vi } from "vitest";

import { findOrCreateCustomer } from "@/modules/customers/features/find-or-create-customer/find-or-create-customer";
import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";

type CustomerLinkRepository = Pick<
  CustomerAuthRepository,
  "findCustomerByWhatsapp" | "createCustomer" | "updateCustomerFullName"
>;

function createRepositoryMock(): CustomerLinkRepository {
  return {
    findCustomerByWhatsapp: vi.fn(),
    createCustomer: vi.fn(),
    updateCustomerFullName: vi.fn(),
  };
}

describe("findOrCreateCustomer", () => {
  it("creates customer when whatsapp does not exist", async () => {
    const repository = createRepositoryMock();
    const find = vi.mocked(repository.findCustomerByWhatsapp);
    const create = vi.mocked(repository.createCustomer);

    find.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({
      id: "customer_01",
      fullName: "Maria",
      whatsappNormalized: "+50588887777",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const customerId = await findOrCreateCustomer(
      {
        fullName: "Maria",
        whatsappNormalized: "+50588887777",
      },
      { repository, logger: { warn: vi.fn() } },
    );

    expect(customerId).toBe("customer_01");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("reuses existing customer and does not overwrite fullName", async () => {
    const repository = createRepositoryMock();
    const find = vi.mocked(repository.findCustomerByWhatsapp);
    const update = vi.mocked(repository.updateCustomerFullName);

    find.mockResolvedValueOnce({
      id: "customer_01",
      fullName: "Nombre Original",
      whatsappNormalized: "+50588887777",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const customerId = await findOrCreateCustomer(
      {
        fullName: "Nombre Nuevo",
        whatsappNormalized: "+50588887777",
      },
      { repository, logger: { warn: vi.fn() } },
    );

    expect(customerId).toBe("customer_01");
    expect(update).not.toHaveBeenCalled();
  });

  it("fills fullName when existing customer has empty fullName", async () => {
    const repository = createRepositoryMock();
    const find = vi.mocked(repository.findCustomerByWhatsapp);
    const update = vi.mocked(repository.updateCustomerFullName);

    find.mockResolvedValueOnce({
      id: "customer_01",
      fullName: null,
      whatsappNormalized: "+50588887777",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    update.mockResolvedValueOnce({
      id: "customer_01",
      fullName: "Maria",
      whatsappNormalized: "+50588887777",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const customerId = await findOrCreateCustomer(
      {
        fullName: "Maria",
        whatsappNormalized: "+50588887777",
      },
      { repository, logger: { warn: vi.fn() } },
    );

    expect(customerId).toBe("customer_01");
    expect(update).toHaveBeenCalledWith("customer_01", "Maria");
  });

  it("recovers from unique race (P2002) by re-reading customer", async () => {
    const repository = createRepositoryMock();
    const find = vi.mocked(repository.findCustomerByWhatsapp);
    const create = vi.mocked(repository.createCustomer);

    find
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "customer_01",
        fullName: "Maria",
        whatsappNormalized: "+50588887777",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    create.mockRejectedValueOnce({ code: "P2002" });

    const customerId = await findOrCreateCustomer(
      {
        fullName: "Maria",
        whatsappNormalized: "+50588887777",
      },
      { repository, logger: { warn: vi.fn() } },
    );

    expect(customerId).toBe("customer_01");
  });

  it("returns null when create fails with non-recoverable error", async () => {
    const repository = createRepositoryMock();
    const find = vi.mocked(repository.findCustomerByWhatsapp);
    const create = vi.mocked(repository.createCustomer);
    const warn = vi.fn();

    find.mockResolvedValueOnce(null);
    create.mockRejectedValueOnce(new Error("db_down"));

    const customerId = await findOrCreateCustomer(
      {
        fullName: "Maria",
        whatsappNormalized: "+50588887777",
      },
      { repository, logger: { warn } },
    );

    expect(customerId).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
