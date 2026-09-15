/**
 * TASK-307 — el recibo del mostrador, como imagen.
 *
 * Decisión del owner (2026-09-14): **sin API de WhatsApp**. El recibo se genera como **JPG en el
 * dispositivo** y se ofrece **enviar** (hoja de compartir del sistema, donde WhatsApp es un destino,
 * y donde en Android también está «Imprimir») o **descargar**. Cero dependencias y cero credenciales:
 * un adjunto por API de WhatsApp habría pedido proveedor, token y número emisor.
 *
 * El ticket no inventa datos: todo sale del pedido y de la configuración del negocio. El texto se
 * arma con una función **pura** (`buildReceiptTextLines`) para poder probarlo sin canvas, y el dibujo
 * se mide en el navegador real.
 */

export type ReceiptLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ReceiptPayment = {
  methodLabel: string;
  amount: number;
  currency: string | null;
};

export type ReceiptData = {
  businessName: string;
  /** Código ISO de la moneda del negocio: un cobro en otra moneda se muestra con **su** código. */
  businessCurrencyCode: string;
  addressLine?: string | null;
  phone?: string | null;
  orderNumber: string;
  createdAtLabel: string;
  locationName?: string | null;
  customerName?: string | null;
  lines: ReceiptLine[];
  subtotal: number;
  packagingAmount: number;
  discount: number;
  deliveryFeeAmount: number;
  tipAmount: number;
  total: number;
  payments: ReceiptPayment[];
  change: number | null;
};

/** Ancho del ticket en píxeles (una impresora térmica de 58 mm ronda los 384; acá se dibuja al doble). */
export const RECEIPT_WIDTH = 384;
const SCALE = 2;

/**
 * Las líneas del ticket, en orden de lectura. `formatMoney` viene de la configuración del negocio: el
 * símbolo de la moneda no se escribe acá (el contrato anti-hardcode lo prohíbe).
 */
export function buildReceiptTextLines(
  data: ReceiptData,
  formatMoney: (value: number) => string,
): string[] {
  const lines: string[] = [
    data.businessName,
    ...(data.addressLine ? [data.addressLine] : []),
    ...(data.phone ? [`Tel. ${data.phone}`] : []),
    "",
    `Pedido ${data.orderNumber}`,
    data.createdAtLabel,
    ...(data.locationName ? [`Retiro en ${data.locationName}`] : []),
    ...(data.customerName ? [`Cliente: ${data.customerName}`] : []),
    "",
  ];

  for (const line of data.lines) {
    lines.push(`${line.quantity} x ${line.name}`);
    lines.push(`    ${formatMoney(line.unitPrice)}  ${formatMoney(line.lineTotal)}`);
  }

  lines.push("", `Subtotal ${formatMoney(data.subtotal)}`);

  if (data.packagingAmount > 0) lines.push(`Empaque ${formatMoney(data.packagingAmount)}`);
  if (data.discount > 0) lines.push(`Descuento -${formatMoney(data.discount)}`);
  if (data.deliveryFeeAmount > 0) lines.push(`Envio ${formatMoney(data.deliveryFeeAmount)}`);
  if (data.tipAmount > 0) lines.push(`Propina ${formatMoney(data.tipAmount)}`);

  lines.push(`TOTAL ${formatMoney(data.total)}`);

  for (const payment of data.payments) {
    // Un cobro en otra moneda se muestra con su **código**, no con el símbolo del negocio: decir
    // "C$3.00" por un cobro de US$3 sería un número falso (la misma regla que el detalle del pedido).
    const isBusinessCurrency =
      !payment.currency || payment.currency === data.businessCurrencyCode;
    const amount = isBusinessCurrency
      ? formatMoney(payment.amount)
      : `${payment.currency} ${payment.amount.toFixed(2)}`;
    lines.push(`Cobrado ${payment.methodLabel} ${amount}`);
  }

  if (data.change !== null) lines.push(`Cambio ${formatMoney(data.change)}`);

  lines.push("", "Gracias por su compra");

  return lines;
}

/**
 * Dibuja el ticket y devuelve un JPEG. Se hace en un `<canvas>` fuera de pantalla: no hay servidor de
 * por medio ni librería de PDF, y el resultado es una imagen que se puede mandar o imprimir.
 */
export async function renderReceiptJpeg(data: ReceiptData): Promise<Blob> {
  const lines = buildReceiptTextLines(data, (value) => formatReceiptNumber(value));
  const lineHeight = 18 * SCALE;
  const padding = 16 * SCALE;

  const canvas = document.createElement("canvas");
  canvas.width = RECEIPT_WIDTH * SCALE;
  canvas.height = padding * 2 + lines.length * lineHeight;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo dibujar el recibo en este dispositivo.");

  // El recibo es un **documento**, no una superficie de la interfaz: va en blanco y negro para que
  // se lea impreso, sin depender de la apariencia que el negocio configuró para la pantalla.
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "black";
  context.font = `${14 * SCALE}px "Courier New", monospace`;
  context.textBaseline = "top";

  lines.forEach((line, index) => {
    context.fillText(line, padding, padding + index * lineHeight);
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen."))),
      "image/jpeg",
      0.92,
    );
  });
}

/**
 * Envía el recibo con la hoja de compartir del sistema (ahí está WhatsApp, y en Android también
 * «Imprimir»). Si el dispositivo no puede compartir archivos —una computadora de escritorio, por
 * ejemplo— **descarga el JPG**: es la misma imagen, sin depender de nada.
 */
export async function shareOrDownloadReceipt(
  blob: Blob,
  fileName: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], fileName, { type: "image/jpeg" });
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShare) {
    try {
      await navigator.share({ files: [file], title: `Recibo ${fileName}` });
      return "shared";
    } catch {
      // El usuario canceló o el sistema falló: se sigue con la descarga, que es lo mismo pero local.
    }
  }

  downloadBlob(blob, fileName);
  return "downloaded";
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Número con dos decimales, sin símbolo: el símbolo lo pone la configuración del negocio. */
function formatReceiptNumber(value: number): string {
  return value.toFixed(2);
}
