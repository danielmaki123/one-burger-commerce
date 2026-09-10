import { headers } from "next/headers";

import { getPublicBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { normalizeHost, resolveMenuAppUrl } from "@/shared/config/host-routing";

import { LandingExperience } from "./landing-experience";

/**
 * Landing del dominio de marca.
 *
 * Se sirve en `/` mediante un rewrite del proxy cuando el host es el apex (o
 * `www`), y también queda accesible en `/landing` para poder probarla en
 * cualquier entorno.
 */
export default async function LandingPage() {
  const settings = await getPublicBusinessSettings();
  const requestHeaders = await headers();
  const host = normalizeHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );

  // La app de pedidos vive en `menu.<dominio>`. Si no se puede deducir el
  // subdominio (local, IP, host de la plataforma) el botón cae al menú de este
  // mismo host, que siempre existe.
  const menuUrl = resolveMenuAppUrl(host) ?? "/menu";

  return (
    <LandingExperience brandName={settings.name} menuUrl={menuUrl} menuLabel="MENÚ" />
  );
}
