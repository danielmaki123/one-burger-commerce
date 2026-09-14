/**
 * B4 — la regla de búsqueda de una comanda, en el dominio.
 *
 * Vive acá y no en cada adaptador porque **los dos tienen que decir lo mismo**: el adaptador de Prisma
 * la traduce a SQL y el de memoria la aplica fila por fila (es el que usan los tests del caso de uso).
 * Si la regla se copiara, el día que cambie una el test pasaría con una semántica y la pantalla
 * mostraría otra.
 *
 * Se busca por lo que la persona tiene a mano cuando pregunta: el número que se dictó por teléfono, el
 * nombre, el WhatsApp desde el que escribió o el PIN que el cliente está esperando en el mostrador. El
 * WhatsApp se compara por **contiene**, así los últimos dígitos alcanzan (nadie dicta el +505).
 */

export type SearchableOrder = {
  orderNumber: string;
  customerName: string;
  customerWhatsapp: string;
  pickupPin?: string | null;
};

/** El término listo para comparar, o `null` si no hay nada que buscar (espacios no cuentan). */
export function normalizeOrderSearch(term: string | null | undefined): string | null {
  const trimmed = term?.trim();

  return trimmed ? trimmed.toLowerCase() : null;
}

/** Solo los dígitos: en la base el PIN es un texto corto y el usuario puede escribirlo con espacios. */
export function searchDigits(term: string): string {
  return term.replace(/\D/g, "");
}

export function orderMatchesSearch(order: SearchableOrder, term: string): boolean {
  const needle = normalizeOrderSearch(term);
  if (!needle) return true;

  if (order.orderNumber.toLowerCase().includes(needle)) return true;
  if (order.customerName.toLowerCase().includes(needle)) return true;
  if (order.customerWhatsapp.toLowerCase().includes(needle)) return true;

  const digits = searchDigits(needle);

  return digits.length > 0 && (order.pickupPin ?? "").includes(digits);
}
