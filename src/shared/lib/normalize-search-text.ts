/**
 * Normalización de texto para buscar en el menú.
 *
 * Vive en `shared` porque la usan el buscador del menú y el de la home: si cada
 * uno normalizara a su manera, el mismo término daría resultados distintos según
 * la pantalla.
 */
export function normalizeSearchText(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-NI");
}
