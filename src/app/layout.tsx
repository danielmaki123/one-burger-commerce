import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";

import "@/app/globals.css";

import { getPublicBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { businessSettingsStyleVariables } from "@/modules/business-settings/domain/business-settings-style";
import type { FontChoice } from "@/modules/business-settings/domain/business-settings.types";
import { resolveFaviconUrl } from "@/modules/business-settings/domain/brand-assets";
import {
  BusinessSettingsProvider,
  type BusinessSettingsValue,
} from "@/shared/lib/business-settings";

/**
 * La configuración del negocio vive en la base, así que todo el árbol se
 * renderiza por request. Sin esto Next prerenderizaría las páginas en el build
 * de la imagen (que no tiene `DATABASE_URL`) y el branding quedaría congelado
 * hasta el siguiente deploy.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const fraunces = localFont({
  src: [
    {
      path: "./fonts/fraunces-regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/fraunces-bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-fraunces",
});

const inter = localFont({
  src: [
    {
      path: "./fonts/inter-regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/inter-bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-inter",
});

/**
 * Plus Jakarta Sans: la tipografía del mock (T1.2, decisión D-A). Los dos pesos
 * son los que usa el diseño (400 para texto, 700/800 para títulos); el
 * `font-weight: 800` de la escala del mock resuelve a 700.
 */
const jakarta = localFont({
  src: [
    {
      path: "./fonts/plus-jakarta-sans-regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/plus-jakarta-sans-bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-jakarta",
});

/**
 * JetBrains Mono: la tipografía de NÚMEROS del sistema Stitch
 * (`ops/references/stitch/design-system.md` §2.1). Es obligatoria para plata, cronómetros, IDs de
 * ticket, PIN y contadores, con `tabular-nums`, para que la interfaz no "tiemble" cuando esos
 * valores cambian solos. No es una fuente de marca (esas las elige el negocio en `/admin/settings`),
 * así que va por `next/font/google` y no como archivo local.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

/**
 * `satisfies` es lo que impide agregar una tipografía al admin y olvidarse de
 * incluirla en el build: si `FONT_CHOICES` crece, este objeto no compila.
 */
const fonts = {
  fraunces,
  inter,
  jakarta,
} satisfies Record<FontChoice, ReturnType<typeof localFont>>;

/**
 * Todas las variables se aplican al `<html>`: `next/font` solo emite el
 * `@font-face` y la variable CSS del objeto que aparece en el árbol. Nombrando
 * las clases una por una, agregar una tipografía y olvidarla acá la dejaba sin
 * definir, y el navegador caía a la del sistema sin ningún error.
 */
const fontVariables = [
  ...Object.values(fonts).map((font) => font.variable),
  // La mono del sistema Stitch no es una tipografía de marca: va aparte de `fonts` para que el
  // `satisfies` siga obligando a que TODA opción de `/admin/settings` esté en el build.
  jetbrainsMono.variable,
].join(" ");

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicBusinessSettings();
  const icon = resolveFaviconUrl(settings);
  const description = settings.description ?? undefined;

  return {
    title: settings.name,
    description,
    applicationName: settings.name,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: icon ? [{ url: icon, sizes: "any", type: "image/svg+xml" }] : undefined,
      apple: icon ?? undefined,
    },
    openGraph: {
      title: settings.name,
      description,
      siteName: settings.name,
      type: "website",
      images: settings.ogImageUrl ? [settings.ogImageUrl] : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getPublicBusinessSettings();

  const value: BusinessSettingsValue = {
    ...settings,
    updatedAt: settings.updatedAt.toISOString(),
  };

  return (
    <html
      lang="es"
      className={fontVariables}
      style={businessSettingsStyleVariables(settings)}
    >
      <body className="antialiased">
        <BusinessSettingsProvider settings={value}>{children}</BusinessSettingsProvider>
      </body>
    </html>
  );
}
