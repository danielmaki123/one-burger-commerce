export type PublicNotFoundContent = {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: { href: string; label: string };
  secondaryAction: { href: string; label: string };
};

/**
 * Copy del 404. El nombre del negocio se resuelve afuera: acá no puede quedar
 * escrito a mano.
 */
export function publicNotFoundContentFor(businessName: string): PublicNotFoundContent {
  return {
    eyebrow: businessName,
    title: "Esta página no está disponible",
    description: "Volvé al inicio o explorá nuestra carta para seguir con tu visita.",
    primaryAction: { href: "/menu", label: "Ver menú" },
    secondaryAction: { href: "/", label: "Ir al inicio" },
  };
}
