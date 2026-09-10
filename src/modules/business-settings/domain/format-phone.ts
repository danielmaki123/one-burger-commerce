/**
 * Agrupa un teléfono E.164 para mostrarlo: `+50588770888` → `+505 8877 0888`.
 *
 * Solo se aplica al patrón de 3 dígitos de país + 8 de número (el de Nicaragua y
 * varios países de la región). Cualquier otro largo se devuelve tal cual: es
 * preferible mostrar el E.164 crudo que inventar un agrupado que no corresponde.
 */
export function formatPhoneForDisplay(phone: string | null): string | null {
  if (phone === null) return null;

  const normalized = phone.replace(/[\s-]/g, "");
  if (normalized.length === 0) return null;

  const match = /^\+(\d{3})(\d{4})(\d{4})$/.exec(normalized);
  if (!match) return normalized;

  return `+${match[1]} ${match[2]} ${match[3]}`;
}
