# TASK: Personalización del negocio (quitar todo el hardcodeo)

**Estado:** **CERRADA** (fases 1-4 y 6 desplegadas; la fase 5, subida de assets, quedó
descartada por decisión del owner: requiere un volumen persistente) · **Prioridad:** alta

> Quedó **una excepción conocida**: los turnos de retiro siguen escritos en el código. No se
> arregló acá y se trasladó a `ops/tasks/TASK-checkout-ux.md` §4, junto con el resto de la
> limpieza del checkout.

> Cómo arrancar esta tarea en un chat nuevo: `ops/tasks/START-HERE.md`.
> Decisiones ya resueltas en §8: no hace falta volver a preguntarlas.

## 1. Objetivo

Que **ningún dato del negocio** esté escrito en el código: nombre, colores, tipografías,
logos, contacto, dirección, horarios, moneda, propina y textos operativos deben salir de
una configuración editable desde el admin, con valores por defecto que reproduzcan el
estado actual (producción no debe cambiar al desplegar esta tarea).

**Criterio de aceptación verificable (esto es lo que cierra la tarea):**

1. Existe `/admin/settings` donde el `owner` edita y guarda esa configuración.
2. Los cambios se ven en el sitio público (nombre, colores, logo, teléfono, dirección,
   horarios, copy de pago y propina) sin tocar código ni redeployar.
3. Un **test de contrato anti-hardcode** recorre las superficies públicas y falla si vuelve
   a aparecer un literal del negocio (nombre por defecto, teléfono, redes, horarios, `C$`)
   fuera del módulo de defaults y del seed.

## 2. Inventario de lo hardcodeado hoy

| Dónde | Qué está fijo |
|---|---|
| `src/app/layout.tsx` | `title`/`description`, iconos, **teléfono** `tel:+50588770888`, **horario** "Lun - Dom 12:00 - 22:00", Instagram `@oneburger`, copy del footer |
| `src/shared/config/app-metadata.ts` | `serviceName` / `description` del producto |
| `src/app/(public)/page.tsx` | 6 menciones de marca en el hero y accesos rápidos |
| `src/app/(public)/success/[orderId]/order-success-view.tsx` | "Gracias por elegir One Burger.", copy de pago |
| `src/app/(public)/checkout/page.tsx` | "Pagás en el local al retirar tu pedido", opciones de hora de retiro (`asap`/"19:30"), etiqueta y 10 % de propina — **los turnos de retiro quedaron sin arreglar**: ver `TASK-checkout-ux.md` §4 |
| `src/app/not-found-content.ts` | Copy de marca del 404 |
| `src/shared/lib/order-totals.ts` | `DEFAULT_TIP_RATE = 10` |
| `src/shared/lib/format-currency.ts` | Símbolo `C$` y locale `es-NI` |
| `src/modules/notifications/domain/order-created-notification.ts` | "🛎️ NUEVA ORDEN - ONE BURGER" |
| `src/app/(admin)/admin/_components/admin-shell.tsx` | "One Burger · Admin operativo" |
| `public/manifest.webmanifest` | Nombre, colores e iconos del PWA (archivo estático) |
| `public/brand/one-burger-mark.svg` | Logo, favicon y apple-touch-icon |
| `src/app/globals.css` | Tokens de color (y el comentario "Casa Antigua visual system v2") |
| `prisma/seed.ts` | Datos demo (correcto que existan, pero deben derivar de los defaults) |

No es objetivo de esta tarea: precios de productos (ya editables), zonas de delivery
(fuera del MVP) y multi-sucursal/multi-tenant.

## 3. Modelo de datos propuesto

Módulo DDD nuevo: `src/modules/business-settings/{domain,features,ports,adapters}`.

```prisma
model BusinessSettings {
  id                   String   @id @default("default")
  // Identidad
  name                 String   @default("One Burger")
  tagline              String?
  description          String?              // meta description / SEO
  logoUrl              String?              // logo completo (footer/confirmaciones)
  logoMarkUrl          String?              // isotipo (header, PWA)
  faviconUrl           String?
  ogImageUrl           String?
  // Apariencia
  primaryColor         String   @default("#2b6c96")
  accentColor          String   @default("#eaf1f6")
  backgroundColor      String   @default("#fbf9f5")
  foregroundColor      String   @default("#23303a")
  surfaceColor         String   @default("#ffffff")
  headingFont          String   @default("fraunces")   // entre las fuentes incluidas
  bodyFont             String   @default("inter")
  // Contacto y ubicación
  phone                String?
  whatsapp             String?              // E.164 sin "+"
  email                String?
  instagram            String?
  facebook             String?
  tiktok               String?
  addressLine          String?
  city                 String?
  addressReference     String?
  mapsUrl              String?
  latitude             Float?
  longitude            Float?
  // Operación
  timezone             String   @default("America/Managua")
  businessHours        Json                   // {"mon":{"closed":false,"open":"12:00","close":"22:00"},...}
  currencyCode         String   @default("NIO")
  currencySymbol       String   @default("C$")
  locale               String   @default("es-NI")
  pickupLeadMinutes    Int      @default(25)
  paymentInstructions  String?  @default("Pagás en el local al retirar tu pedido. No se cobra nada online.")
  tipEnabled           Boolean  @default(true)
  tipRate              Int      @default(10)
  isAcceptingOrders    Boolean  @default(true)
  closedMessage        String?  @default("Estamos cerrados. Podés mirar el menú y volver cuando abramos.")
  updatedAt            DateTime @updatedAt
  updatedByUserId      String?
}
```

Una sola fila (`id = "default"`). El **seed de la migración** crea esa fila con los valores
actuales para que nada cambie visualmente al desplegar.

Fase 5 (opcional): `model BrandAsset { id, kind, mimeType, byteSize, storagePath, publicUrl, createdAt }`
para subir logos en vez de pegar URLs.

## 4. Cómo se aplica en el front (diseño técnico)

- **Colores**: `globals.css` usa `@theme inline` mapeando tokens (`--color-brand: var(--brand)`…).
  Alcanza con definir los tokens base en el `<html>` con un `style` inline desde la config
  (React acepta custom properties). Nada de HTML inyectado. Las variantes hover/strong se
  derivan con `color-mix()` en CSS.
  - Editables: `--brand`, `--background`, `--foreground`, `--card`, `--accent`.
  - **No** editables: semánticos de estado (`success`, `warning`, `destructive`) para no
    romper accesibilidad ni significados.
- **Tipografías**: `next/font/local` ya incluye Fraunces + Inter. El admin elige entre las
  incluidas (sin fetch externo, el build sigue hermético).
- **Metadata/SEO**: `generateMetadata()` en el layout raíz leyendo la config + `metadataBase`
  con el dominio canónico.
- **PWA**: reemplazar `public/manifest.webmanifest` estático por `src/app/manifest.ts`
  (`MetadataRoute.Manifest`) con nombre, colores e iconos configurados.
- **Lectura**: un único `getBusinessSettings()` con `cache()` de React por request y
  `revalidateTag("business-settings")` al guardar. Un `BusinessSettingsProvider` (cliente)
  para lo que necesiten los componentes de carrito/checkout.
- **Moneda**: `formatCurrency(valor, { symbol, locale })` con default; los componentes
  públicos toman el símbolo de la config. El **total sigue calculándose en el servidor**.
- **Propina**: el % sale de la config; el backend lo usa como fuente de verdad y sigue
  rechazando montos del cliente.
- **Notificaciones**: el ticket de Telegram/n8n usa el nombre y el copy configurados.

## 5. Sección de admin (`/admin/settings`)

- Visible solo para `owner` (permiso `canManageBusinessSettings`, o `canManageCriticalConfig`).
- Secciones: **Identidad** (nombre, tagline, logo, favicon) · **Apariencia** (colores,
  tipografía) · **Contacto y ubicación** · **Horarios** · **Operación** (retiro, pago,
  propina, abrir/cerrar pedidos) · **SEO** (título, descripción, imagen OG).
- **Preview en vivo**: una tarjeta que muestra header + botón + card con los colores, logo y
  nombre elegidos, antes de guardar.
- **Validación** con un esquema zod compartido cliente/servidor: hex estricto, teléfono
  E.164, URL https, horarios coherentes (apertura < cierre), `pickupLeadMinutes` 0-180.
  Aviso de **contraste** (WCAG AA) cuando texto/fondo no llega a 4.5:1, sin bloquear.
- Guardado con confirmación, `updatedBy`/`updatedAt` visibles, y "Restablecer" por campo.
- Mensajes de error en español, controles de 44 px, mobile-first.

## 6. Fases (cada una con TDD, validación completa y su commit)

1. **Núcleo de settings**: modelo + migración + seed + dominio + puerto + adaptadores
   (Prisma e in-memory) + casos de uso `getBusinessSettings`/`updateBusinessSettings` +
   validación + tests. Sin tocar UI. *Riesgo bajo, no cambia nada visible.*
2. **Aplicación pública**: layout, metadata, manifest, tokens de color, header/footer,
   contacto y horarios, copy de pago, moneda, propina. Tests + E2E (el sitio debe verse
   igual que hoy porque los defaults son los actuales).
3. **Admin**: sección, permisos, formulario, preview, guardado con revalidación. Tests de UI
   + E2E (cambiar el nombre y verlo en el público).
4. **Apariencia**: colores/tipografía/logo por URL con preview y validación de contraste.
5. **Subida de assets** (opcional, decisión de infra): volumen persistente en Easypanel
   (`/data/brand`) + `POST /api/admin/settings/assets` con validación de mime por bytes,
   límite 1 MB, nombre aleatorio y `Cache-Control` largo; sirve una ruta pública.
6. **Barrido final**: grep de literales de marca/teléfono/horario/moneda, test de contrato
   anti-hardcode, y actualización de `ops/project-state.md` + `README.md`.

## 7. Riesgos y cuidados

- **Producción no debe cambiar** al desplegar: los defaults tienen que ser exactamente los
  valores actuales (verificable con el smoke + una captura antes/después).
- Hay tests de contrato que afirman textos y clases actuales (`admin-ui-contract.test.ts`,
  tests de páginas públicas): se actualizan explicando el nuevo contrato, no se borran.
- El contraste es un riesgo real: permitir cualquier color puede dejar el sitio ilegible.
  Por eso presets curados + validación + preview.
- Cache: si la config queda cacheada de más, el cambio no se ve; si se lee en cada request,
  se castiga la BD. Usar `cache()` por request + `revalidateTag` al guardar, y testear que
  el cambio se refleja en la siguiente carga.
- El PWA cachea assets: al cambiar logo/colores hay que invalidar el service worker
  (ya existe `sw-policy` para decidir qué se cachea).

## 8. Decisiones (resueltas por Daniel el 2026-09-10)

1. **Logo**: fase 1 con **URL** (como las fotos de productos, no bloquea); **subida al
   servidor** en fase 5, que requiere agregar un volumen persistente en Easypanel.
2. **Colores**: **presets curados + ajuste fino** con validación de contraste WCAG AA
   (avisa si el texto no llega a 4.5:1; no bloquea el guardado).
3. **Tipografías**: elegir **entre las dos incluidas** (Fraunces para títulos, Inter para
   texto). No se agregan fuentes externas: el build se mantiene hermético.
4. **Horarios**: **informativos** (footer y ficha del negocio). Bloquear pedidos fuera de
   horario **no** entra en esta tarea: si se quiere, va como tarea aparte porque agrega
   regla de negocio y mensajes nuevos.
5. **Propina**: **configurable** on/off y porcentaje desde el admin. El cálculo sigue
   haciéndose en el servidor con ese valor como fuente de verdad.
6. **Modo oscuro**: fuera de alcance.

Si al implementar aparece una decisión nueva que cambie el alcance, **preguntar antes**:
no inventar reglas de negocio.

## 9. Definición de terminado

- [ ] `/admin/settings` editable por `owner`, con validación, preview y auditoría básica.
- [ ] Ninguna superficie pública muestra datos hardcodeados (test de contrato en verde).
- [ ] Producción igual a antes del cambio (mismos valores por defecto) y luego, si Daniel
      edita algo, el cambio se ve sin redeploy.
- [ ] `npm run test | lint | typecheck | build` + E2E local y smoke productivo en verde.
- [ ] `ops/project-state.md` y el runbook actualizados con la nueva sección.
