"use client";

import * as React from "react";

import { type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";

import PosOrderChargePanel from "./pos-order-charge-panel";

/**
 * `Cobrar pedido` — la acción **secundaria y compacta** de la venta rápida.
 *
 * La Fase 1 saca del workspace la tarjeta permanente «Cobrar un pedido del menú» (ocupaba el lugar de una
 * venta normal) y conserva la funcionalidad detrás de un botón que abre el panel de siempre en un `Modal` del
 * sistema: mismo flujo, misma API, menos espacio.
 *
 * El rediseño funcional de este cobro —banco/procesador, corrección USD— pertenece a la Fase 2 y acá **no** se
 * toca: lo que se mueve es **dónde** vive, no lo que hace.
 *
 * El label lleva el objeto («del menú») y no solo el verbo: `Cobrar` a secas es el cobro de la venta en
 * curso, que es la acción primaria del POS (`CONTENT.md` §5).
 */
export default function PosOrderChargeAction({
  currencies,
  currency,
  terminalId,
}: {
  /** Las monedas del POS (la del negocio y el dólar, como en las filas de cobro). */
  currencies: string[];
  currency: CurrencyFormat;
  /** Fase 6 — la terminal que cobra, para atribuir el cobro a **su** caja. */
  terminalId: string | null;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Cobrar pedido del menú
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cobrar un pedido del menú"
        size="lg"
      >
        <PosOrderChargePanel currencies={currencies} currency={currency} terminalId={terminalId} />
      </Modal>
    </>
  );
}
