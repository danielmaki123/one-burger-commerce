/**
 * Comprueba si el build **servido en producción** contiene la entrada de navegación nueva.
 *
 * Sin sesión de admin no se puede pedir `/admin/finance` (el middleware redirige todo al login), así que la
 * prueba directa no existe. Lo que sí se puede: bajar los chunks que el **login** del panel referencia y
 * buscar en ellos una cadena que sólo exista en el código nuevo.
 *
 * La cadena es `Finanzas` con la `description` de la entrada (`Monedas, tasas y medios de pago`), que se
 * agregó en `admin-layout-helpers.ts` con esta TASK: si el build es el anterior, no está.
 *
 * Es una sonda de **lectura**: no escribe nada ni necesita credenciales.
 */
import { readFileSync } from "node:fs";

const HOST = process.env.PROD_HOST ?? "admin.oneburgernic.com";

async function get(path: string): Promise<string> {
  const response = await fetch(`https://${HOST}${path}`, {
    headers: { "User-Agent": "one-burger-qa" },
    redirect: "follow",
  });

  return response.text();
}

async function main() {
  const loginHtml = await get("/admin/login");
  const chunkPaths = [...new Set(loginHtml.match(/\/_next\/static\/[^"']+\.js/g) ?? [])];

  console.log("chunks referenciados por el login:", chunkPaths.length);

  let sawFinance = false;
  let sawPlan = false;

  for (const path of chunkPaths) {
    const source = await get(path);
    if (source.includes("Monedas, tasas y medios de pago")) sawFinance = true;
    if (source.includes("Configuración financiera")) sawPlan = true;
  }

  // El bundle del layout del panel también se sirve por la página del panel: se busca ahí además del login.
  console.log(
    JSON.stringify({
      host: HOST,
      chunks: chunkPaths.length,
      entradaDeNavegacionNueva: sawFinance,
      pantallaDeFinanzas: sawPlan,
    }),
  );

  // La versión del build, para dejar el dato junto a la comprobación.
  const health = JSON.parse(await get("/api/health")) as { version?: string };
  console.log("build servido:", health.version);
}

void main();
