import type { Metadata } from "next";
import localFont from "next/font/local";

import "@/app/globals.css";

import { getPublicBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { businessSettingsStyleVariables } from "@/modules/business-settings/domain/business-settings-style";
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

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicBusinessSettings();
  const icon = settings.faviconUrl ?? settings.logoMarkUrl;
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
      className={`${fraunces.variable} ${inter.variable}`}
      style={businessSettingsStyleVariables(settings)}
    >
      <body className="antialiased">
        <BusinessSettingsProvider settings={value}>{children}</BusinessSettingsProvider>
      </body>
    </html>
  );
}
