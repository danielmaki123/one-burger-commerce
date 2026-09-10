import type { MetadataRoute } from "next";

import { getPublicBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";

/**
 * Manifest del PWA generado desde la configuración del negocio.
 *
 * Reemplaza al `public/manifest.webmanifest` estático: con archivo fijo, cambiar
 * el nombre, el logo o los colores desde el admin no llegaba al PWA instalado.
 */
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getPublicBusinessSettings();
  const icon = settings.logoMarkUrl ?? settings.faviconUrl;

  return {
    name: settings.name,
    short_name: settings.name,
    description: settings.tagline ?? settings.description ?? undefined,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: settings.backgroundColor,
    theme_color: settings.primaryColor,
    icons: icon
      ? [
          {
            src: icon,
            sizes: "any",
            type: icon.endsWith(".svg") ? "image/svg+xml" : "image/png",
          },
        ]
      : [],
  };
}
