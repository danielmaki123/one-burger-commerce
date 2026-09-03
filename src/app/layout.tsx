import type { Metadata } from "next";
import localFont from "next/font/local";

import "@/app/globals.css";

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
  variable: "--font-heading",
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
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "One Burger Commerce",
  description: "Menu and pickup ordering platform for One Burger.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/one-burger-mark.svg", sizes: "any", type: "image/svg+xml" },
      {
        url: "/brand/one-burger-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    apple: "/brand/one-burger-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${fraunces.variable} ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

