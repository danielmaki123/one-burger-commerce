/**
 * Iniciales del negocio para el isotipo de respaldo (el cuadro de color del
 * header cuando todavía no hay un logo configurado).
 *
 * `"One Burger"` → `"OB"`. Con un nombre vacío devuelve `"?"` para no dejar el
 * recuadro en blanco.
 */
export function businessInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) return "?";

  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}
