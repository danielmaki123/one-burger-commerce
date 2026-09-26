"use client";

import * as React from "react";
import { Mail, Phone, ReceiptText, User } from "lucide-react";

import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";

import { type PosFiscalDraft } from "../pos-fiscal-payload";
import { OverlineLabel, PosDisclosure } from "./pos-disclosure";

/**
 * Los datos del cliente de una venta de mostrador.
 *
 * **Siempre visibles** (una venta normal los necesita): nombre y número. Son obligatorios porque son a quién
 * se le avisa que el pedido está listo.
 *
 * **Bajo demanda**: el correo (opcional) y la factura con RUC (la mayoría de las ventas no la piden). El
 * correo va detrás de un disclosure; la factura, detrás de su tilde —que es el gesto que ya existía— y con
 * los dos campos obligatorios juntos: el RUC (mínimo 8 caracteres) y la razón social.
 *
 * Al destildar la factura se **limpian** los dos datos, para que el próximo cliente no herede los del
 * anterior. Los errores que se muestran son los que el servidor puede devolver por campo
 * (`name`/`customerName`, `whatsapp`/`customerWhatsapp`, `customerEmail`, `taxId`, `legalName`).
 *
 * Los íconos de cada campo van a la derecha y son decorativos (`aria-hidden`): el campo se lee por su
 * etiqueta.
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

/**
 * El campo con su ícono a la derecha, sobre la línea del input (no de la etiqueta) y por encima del texto
 * de error si lo hubiera. El `Input` del sistema no tiene ranura para el ícono: se lo agrega `pr-10` desde
 * afuera en vez de tocar el primitivo que usan todas las pantallas.
 */
function FieldWithIcon({
  field,
  children,
}: {
  field: "name" | "whatsapp" | "email";
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      <span
        data-testid={`pos-customer-icon-${field}`}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-5 flex h-11 items-center text-ink-muted"
      >
        {field === "name" ? (
          <User className="h-4 w-4" />
        ) : field === "whatsapp" ? (
          <Phone className="h-4 w-4" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
      </span>
    </div>
  );
}

export default function PosCustomerFields({
  customer,
  setCustomer,
  fieldErrors,
}: PosCustomerFieldsProps) {
  const fiscal = customer.fiscal;

  return (
    <div className="space-y-3">
      <OverlineLabel>Cliente</OverlineLabel>

      <FieldWithIcon field="name">
        <Input
          label="Nombre del cliente"
          className="pr-10"
          value={customer.name}
          error={fieldErrors.name ?? fieldErrors.customerName}
          onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))}
        />
      </FieldWithIcon>

      <FieldWithIcon field="whatsapp">
        <Input
          label="Número del cliente"
          className="pr-10"
          inputMode="tel"
          value={customer.whatsapp}
          error={fieldErrors.whatsapp ?? fieldErrors.customerWhatsapp}
          onChange={(event) =>
            setCustomer((current) => ({ ...current, whatsapp: event.target.value }))
          }
        />
      </FieldWithIcon>

      <PosDisclosure label="Correo (opcional)">
        <FieldWithIcon field="email">
          <Input
            label="Correo (opcional)"
            className="pr-10"
            type="email"
            value={customer.email}
            error={fieldErrors.customerEmail}
            onChange={(event) =>
              setCustomer((current) => ({ ...current, email: event.target.value }))
            }
          />
        </FieldWithIcon>
      </PosDisclosure>

      <div className="flex items-center gap-2">
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
    </div>
  );
}
