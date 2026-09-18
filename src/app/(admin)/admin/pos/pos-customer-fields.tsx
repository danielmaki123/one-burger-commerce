"use client";

import * as React from "react";

import { Input } from "@/shared/ui/input";

/**
 * Los datos del cliente de una venta de mostrador (extraído de `pos-client.tsx`, que es deuda con techo
 * congelado: no puede crecer).
 *
 * Nombre y número son obligatorios —es a quién se le avisa que el pedido está listo— y el correo es
 * opcional. Los errores que se muestran son los dos que el servidor puede devolver por campo
 * (`name`/`customerName`, `whatsapp`/`customerWhatsapp`, `customerEmail`).
 */

export type PosCustomerDraft = { name: string; whatsapp: string; email: string };

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
    </>
  );
}
