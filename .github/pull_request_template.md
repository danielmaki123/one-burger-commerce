<!--
TASK-AUD-001 — plantilla de PR. Es para que la revisión (humana o de un agente) tenga todo lo que
necesita en un solo lugar, no para llenar casillas: si un campo no aplica, escribí "N/A — <razón>".
Las reglas están en AGENTS.md y el protocolo de tests en AGENTS.md § Integridad de tests.
-->

## Problema / invariante

<!-- Qué está mal (o qué se agrega) y **qué tiene que seguir siendo verdad** después del cambio.
     Si es una TASK, linkeala: `ops/tasks/TASK-...md`. -->

## Qué cambió

<!-- El cambio, archivo por archivo si ayuda. Una sola idea por commit. -->

## Qué NO cambió

<!-- Decilo explícitamente: alcance, comportamiento, esquema, UI, producción. Esto evita el 80% de las dudas. -->

## Test RED observado

<!-- Pegá el fallo real del test **antes** del arreglo (o el de la implementación mínima del feature).
     Si no se pudo observar el rojo: motivo, cómo se validó el test y qué flujo cubre. -->

## Mutation check

<!-- Después del GREEN: qué mutación introdujiste, qué test se puso rojo, y confirmá que **no** quedó
     commiteada. Si no aplica, decí por qué. -->

## Tests modificados

<!-- Si tocaste un acceptance/contract test existente: **por qué cambió el contrato**, no solo qué cambió.
     Un test que se ajusta para pasar sin justificar el cambio de contrato no se mergea. -->

## Review adversarial

<!-- Pasada corta intentando REFUTAR la solución, no confirmarla. Contestá las que apliquen. -->

- [ ] ¿Puede el CI estar verde y el requisito seguir **roto**?
- [ ] ¿Hay algún **test tautológico** o un `expected` calculado con la misma función bajo prueba?
- [ ] ¿El **mock** es demasiado permisivo (devuelve lo que la implementación quiere oír)?
- [ ] ¿Faltan **escenarios negativos** (sin permiso, fuera de alcance, dato inválido, límite)?
- [ ] ¿Hay **race condition**? ¿Dos requests simultáneos rompen la invariante?
- [ ] ¿Hay **partial write** (una parte se guarda y la otra no)?
- [ ] ¿La **autorización** vive solo en la UI?
- [ ] ¿Se **tragó** un error (`catch` vacío, `?? default` que esconde un fallo)?
- [ ] ¿Se duplicó una regla o se creó una **segunda fuente de verdad**?
- [ ] ¿Hay **rollback** e **idempotencia** donde corresponde (reintentos, doble click)?

## Validación

<!-- Los comandos que corriste y su resultado. Base:
     `npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build`
     Si tocaste una página (`src/app/**/page.tsx`): `npm run build:webpack`.
     Si el cambio tiene UI: navegador real a 375 px y 1280 px + captura antes/después. -->

## Riesgos y seguimiento

<!-- Qué queda abierto, qué se documentó en vez de arreglarse, y qué TASK lo tomaría. -->
