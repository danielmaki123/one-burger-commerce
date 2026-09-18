"use client";

import * as React from "react";
import { ReceiptText } from "lucide-react";

import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";

import { type PosFiscalDraft } from "./pos-fiscal-payload";

/**
 * Los datos del cliente de una venta de mostrador (extraído de `pos-client.tsx`, que es deuda con techo
 * congelado: no puede crecer).
 *
 * Nombre y número son obligatorios —es a quién se le avisa que el pedido está listo— y el correo es
 * opcional. Los errores que se muestran son los dos que el servidor puede devolver por campo
 * (`name`/`customerName`, `whatsapp`/`customerWhatsapp`, `customerEmail`).
 *
 * **Punto 4 (2026-09-18)**: después del correo va el tilde **«Cliente pide factura con RUC»**, con su
 * ícono `ReceiptText`. Con el tilde puesto aparecen el RUC (mínimo 8 caracteres) y la razón social, los
 * dos obligatorios; al destildarlo se limpian, para que el próximo cliente no herede los del anterior.
 */

export type PosCustomerDraft = {
  name: string;
  whatsapp: string;
  email: string;
  fiscal: PosFiscalDraft;
};

type PosCustomerFieldsProps = {
  customer: PosCustomerDraft;
  setCustomer: React.Dispatch<React.SetStateAction<PosCustomerDraft>>;
  fieldErrors: Record<string, string>;
};

export default function PosCustomerFields({
  customer,
  setCustomer,
  fieldErrors,
}: PosCustomerFieldsProps) {
  const fiscal = customer.fiscal;

  return (
    <>
      <Input
        label="Nombre del cliente"
        value={customer.name}
        error={fieldErrors.name ?? fieldErrors.customerName}
        onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))}
      />
      <Input
        label="Número del cliente"
        inputMode="tel"
        value={customer.whatsapp}
        error={fieldErrors.whatsapp ?? fieldErrors.customerWhatsapp}
        onChange={(event) => setCustomer((current) => ({ ...current, whatsapp: event.target.value }))}
      />
      <Input
        label="Correo (opcional)"
        type="email"
        value={customer.email}
        error={fieldErrors.customerEmail}
        onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))}
      />

      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-st-caption font-medium text-ink-secondary">
          <ReceiptText aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" strokeWidth={2} />
          <Checkbox
            label="Cliente pide factura con RUC"
            checked={fiscal.wantsInvoice}
            onChange={(event) =>
              setCustomer((current) => ({
                ...current,
                // Al destildarlo se limpian los dos datos: el RUC de este cliente no es el del siguiente.
                fiscal: event.target.checked
                  ? { ...current.fiscal, wantsInvoice: true }
                  : { wantsInvoice: false, taxId: "", legalName: "" },
              }))
            }
          />
        </span>
      </div>

      {fiscal.wantsInvoice ? (
        <>
          <Input
            label="RUC (mínimo 8 caracteres)"
            value={fiscal.taxId}
            error={fieldErrors.taxId}
            onChange={(event) =>
              setCustomer((current) => ({
                ...current,
                fiscal: { ...current.fiscal, taxId: event.target.value },
              }))
            }
          />
          <Input
            label="Razón social"
            value={fiscal.legalName}
            error={fieldErrors.legalName}
            onChange={(event) =>
              setCustomer((current) => ({
                ...current,
                fiscal: { ...current.fiscal, legalName: event.target.value },
              }))
            }
          />
        </>
      ) : null}
    </>
  );
}
