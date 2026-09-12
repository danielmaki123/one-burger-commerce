# Módulo `business-settings`

Configuración del negocio editable desde `/admin/settings`. Es la **única fuente
de verdad** para el nombre, los colores, las tipografías, los logos, el contacto,
la dirección, los horarios, la moneda, la propina y los textos operativos:
ninguna superficie pública ni API debería escribir esos valores a mano.

Ver `ops/tasks/TASK-whitelabel-branding.md`.

## Estructura

```
domain/
  business-settings.types.ts       tipos, claves de día y patrones de validación
  business-settings-defaults.ts    DEFAULT_BUSINESS_SETTINGS (reproduce el estado actual)
  business-settings.schema.ts      esquema zod compartido cliente/servidor
  business-hours.ts                fusión y lectura defensiva de los horarios
  business-settings-errors.ts      BusinessSettingsError
ports/
  business-settings-repository.ts  get / update
adapters/
  prisma-business-settings-repository.ts
  in-memory-business-settings-repository.ts
features/
  get-business-settings/
  update-business-settings/
```

Una sola fila (`id = "default"`): la configuración del negocio es única. Lo que **sí** es por
sucursal (dirección, contacto, horario, minutos de preparación, si acepta pedidos y qué productos y a
qué precios) vive en el módulo **`locations`** (T8) y esta fila queda como **respaldo** cuando el
negocio no tiene ningún local cargado. La **zona horaria** sigue siendo del negocio: el horario de
cada local se interpreta en ella.

## Reglas

- **Los defaults son sagrados**: `DEFAULT_BUSINESS_SETTINGS` reproduce exactamente
  lo que había hardcodeado en el sitio público. Cambiarlos cambia producción; si
  se toca un valor hay que tocar también la migración
  (`prisma/migrations/*_add_business_settings/migration.sql`) y el test de
  contrato lo verifica.
- **La validación es una sola**: `parseBusinessSettingsPatch` es la puerta de
  entrada tanto del API route como del formulario del admin. El caso de uso
  recibe el payload crudo a propósito.
- **La auditoría la maneja el repositorio**: `id`, `updatedAt` y
  `updatedByUserId` se descartan del payload del cliente.
- **Los horarios se fusionan día por día**: el admin puede mandar un solo día y
  el resto se conserva. En la base siempre queda la semana completa.
- **El JSON guardado no se confía**: `readBusinessHours` normaliza cada día y
  descarta lo que no tenga forma válida en vez de romper el sitio público.
