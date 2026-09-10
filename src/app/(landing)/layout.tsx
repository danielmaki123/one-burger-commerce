import "./landing/landing.css";

/**
 * El landing es una experiencia a pantalla completa: no lleva el header ni el
 * footer del sitio público, así que vive en su propio grupo de rutas.
 */
export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
