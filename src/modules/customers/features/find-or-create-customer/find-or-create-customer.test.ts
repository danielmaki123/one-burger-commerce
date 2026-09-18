import { describe, expect, it, vi } from "vitest";

import { findOrCreateCustomer } from "@/modules/customers/features/find-or-create-customer/find-or-create-customer";
import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";

type CustomerLinkRepository = Pick<
  CustomerAuthRepository,
  | "findCustomerByWhatsapp"
  | "createCustomer"
  | "updateCustomerFullName"
  | "updateCustomerFiscalData"
>;

function createRepositoryMock(): CustomerLinkRepository {
  return {
    findCustomerByWhatsapp: vi.fn(),
    createCustomer: vi.fn(),
    updateCustomerFullName: vi.fn(),
    updateCustomerFiscalData: vi.fn(),
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

  describe("datos fiscales (Punto 4)", () => {
    const existing = {
      id: "customer_01",
      fullName: "Distribuidora La Unión",
      whatsappNormalized: "+50588887777",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("los guarda en el cliente que ya existía", async () => {
      const repository = createRepositoryMock();
      const updateFiscal = vi.mocked(repository.updateCustomerFiscalData);
      vi.mocked(repository.findCustomerByWhatsapp).mockResolvedValueOnce(existing);
      updateFiscal.mockResolvedValueOnce({ ...existing, taxId: "J0310000001" });

      const customerId = await findOrCreateCustomer(
        {
          fullName: "Distribuidora La Unión",
          whatsappNormalized: "+50588887777",
          taxId: "  J0310000001 ",
          legalName: " Distribuidora La Unión ",
        },
        { repository, logger: { warn: vi.fn() } },
      );

      expect(customerId).toBe("customer_01");
      expect(updateFiscal).toHaveBeenCalledWith("customer_01", {
        taxId: "J0310000001",
        legalName: "Distribuidora La Unión",
      });
    });

    it("también los guarda cuando el cliente se acaba de crear", async () => {
      const repository = createRepositoryMock();
      const updateFiscal = vi.mocked(repository.updateCustomerFiscalData);
      vi.mocked(repository.findCustomerByWhatsapp).mockResolvedValueOnce(null);
      vi.mocked(repository.createCustomer).mockResolvedValueOnce(existing);
      updateFiscal.mockResolvedValueOnce(existing);

      const customerId = await findOrCreateCustomer(
        {
          fullName: "Distribuidora La Unión",
          whatsappNormalized: "+50588887777",
          taxId: "J0310000001",
          legalName: "Distribuidora La Unión",
        },
        { repository, logger: { warn: vi.fn() } },
      );

      expect(customerId).toBe("customer_01");
      expect(updateFiscal).toHaveBeenCalledWith("customer_01", {
        taxId: "J0310000001",
        legalName: "Distribuidora La Unión",
      });
    });

    it("sin factura no toca los datos fiscales que el cliente ya tenía", async () => {
      const repository = createRepositoryMock();
      const updateFiscal = vi.mocked(repository.updateCustomerFiscalData);
      vi.mocked(repository.findCustomerByWhatsapp).mockResolvedValueOnce(existing);

      await findOrCreateCustomer(
        { fullName: "Distribuidora La Unión", whatsappNormalized: "+50588887777" },
        { repository, logger: { warn: vi.fn() } },
      );

      expect(updateFiscal).not.toHaveBeenCalled();
    });

    it("media factura no se guarda: el RUC sin razón social se descarta", async () => {
      const repository = createRepositoryMock();
      const updateFiscal = vi.mocked(repository.updateCustomerFiscalData);
      vi.mocked(repository.findCustomerByWhatsapp).mockResolvedValueOnce(existing);

      await findOrCreateCustomer(
        {
          fullName: "Distribuidora La Unión",
          whatsappNormalized: "+50588887777",
          taxId: "J0310000001",
        },
        { repository, logger: { warn: vi.fn() } },
      );

      expect(updateFiscal).not.toHaveBeenCalled();
    });

    it("si el guardado fiscal falla, la venta no se pierde", async () => {
      const repository = createRepositoryMock();
      vi.mocked(repository.findCustomerByWhatsapp).mockResolvedValueOnce(existing);
      vi.mocked(repository.updateCustomerFiscalData).mockRejectedValueOnce(new Error("db_down"));

      const customerId = await findOrCreateCustomer(
        {
          fullName: "Distribuidora La Unión",
          whatsappNormalized: "+50588887777",
          taxId: "J0310000001",
          legalName: "Distribuidora La Unión",
        },
        { repository, logger: { warn: vi.fn() } },
      );

      // La factura es un dato del cliente, no la venta: se sigue con el pedido.
      expect(customerId).toBe("customer_01");
    });
  });
});
