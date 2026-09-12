# `src/shared`

Código compartido entre módulos y capas. Nada de acá conoce a un módulo de negocio en particular.

```
ui/       componentes de interfaz reutilizables (WhatsApp input, controles táctiles, etc.)
lib/      helpers sin estado: http/error-response.ts, auth/session-token.ts, formato, carrito, etc.
config/   constantes y contratos de configuración (incluye los tests de contrato del deploy)
pwa/      service worker, manifest y registro
```

Reglas:

- **Los errores de dominio se mapean acá**: cada módulo lanza su error tipado (`OrderError`,
  `AuthError`, …) y `lib/http/error-response.ts` lo traduce a status + body. No armar respuestas de
  error a mano en cada route.
- `config/` alberga los **tests de contrato** que leen archivos del repo (Dockerfile, CI, migraciones)
  para que un cambio de infraestructura no pase sin verificación.
- Estilos con los **tokens semánticos** de `src/app/globals.css` (`bg-card`, `text-foreground`,
  `bg-brand`, `border-border`): nada de colores sueltos ni clases ad hoc.
- Español en los textos de UI; inglés en nombres de archivos, funciones, tipos y variables.
