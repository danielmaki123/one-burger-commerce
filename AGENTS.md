# AGENTS.md

## Proyecto

One Burger Commerce es un MVP de restaurante enfocado en:

- menu publico
- carrito
- checkout solo para retirar en restaurante
- admin de ordenes
- admin de menu
- admin de usuarios con roles

## Reglas

- Responder y documentar en espanol.
- No usar instrucciones heredadas de Casa Antigua como autoridad para este repo.
- Mantener DDD: dominio, casos de uso, puertos/adaptadores e infraestructura separados.
- Trabajar con TDD por fase para cambios funcionales.
- No reactivar reservas, mesas, delivery o inventario en la navegacion principal sin aprobacion explicita.
- No commitear secretos, `.env`, caches, metadata de agentes ni artefactos de build.

## Roles

- `owner`: acceso completo, incluyendo usuarios.
- `manager`: ordenes y menu.
- `kitchen`: ordenes.

## Validacion minima

Antes de cerrar cambios funcionales:

```bash
npm run test
npm run lint
npm run typecheck
```
