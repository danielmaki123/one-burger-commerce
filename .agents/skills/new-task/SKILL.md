# SKILL: new-task — iniciar cualquier TASK

**Se activa** al empezar una TASK nueva (funcionalidad, corrección, deuda, docs o auditoría).
**Produce**: una rama lista y un alcance declarado, **sin** haber tocado todavía el producto.

> Regla del repo: *plan escrito = alcance ya resuelto*. Lo que la TASK decide se ejecuta de corrido.
> Se pregunta solo por lo que la TASK **no** decide.

---

## 1. Procedimiento

### Fase 0 — Repo y rama (antes de leer nada más)

```bash
git status --short                      # tiene que estar limpio (salvo residuos locales que no se commitean)
git branch --show-current               # no se trabaja sobre main
git fetch origin
git checkout main
git pull --ff-only origin main
git rev-parse HEAD                      # ANOTAR: es la BASE MAIN del reporte final
git checkout -b <tipo>/<nombre-descriptivo>
```

- Si `git status` **no** está limpio y hay cambios que no son de la TASK: **parar y preguntar**. No se
  arrastra trabajo ajeno a la rama.
- Nomenclatura: `feature/` · `fix/` · `refactor/` · `docs/` · `chore/`.
- Si el origen de la TASK es la cola de auditoría, el tipo casi siempre es `fix/`.

### Fase 1 — Lectura obligatoria, en este orden

1. [`../../../AGENTS.md`](../../../AGENTS.md) — reglas y límites.
2. [`../../CONTEXT.md`](../../CONTEXT.md) — cómo está construido el sistema.
3. [`../../../ops/CURRENT.md`](../../../ops/CURRENT.md) — qué está vivo hoy y qué riesgos hay abiertos.
4. La TASK (el brief, el roadmap o el pedido explícito del owner).
5. [`../../MEMORY.md`](../../MEMORY.md) — **si** la TASK toca un área donde sus lecciones aplican.
6. La skill específica: `bugfix` · `money-change` · `database-migration` · `security-change` ·
   `ui-change` · `audit` · `production-release`.

**No** se carga el historial por defecto: [`../../../ops/history/`](../../../ops/history/) se consulta
a propósito, cuando hace falta reconstruir por qué algo es como es.

### Fase 2 — Declarar el alcance (escrito, antes de codear)

Completar la plantilla de [`../../../ops/tasks/TEMPLATE.md`](../../../ops/tasks/TEMPLATE.md) —o la
versión corta del §3— y dejarla en la TASK o en el cuerpo del PR.

1. **Bounded context**: qué módulo(s) de `src/modules/` son dueños del cambio. Si son dos, decirlo:
   dos contextos en una TASK es una señal de alcance grande.
2. **Riesgos**: ¿toca dinero, auth, datos, migraciones, infraestructura o producción? (ver §2).
3. **Scope IN**: qué cambia exactamente, archivo por archivo si se puede.
4. **Scope OUT**: qué **no** cambia, dicho explícitamente. Es la parte que evita el 80% de las
   discusiones.
5. **Tests afectados**: qué tests existen hoy sobre eso y cuáles deberían cambiar. Un test existente
   que va a cambiar **exige justificación** (contrato nuevo o decisión del owner), no «lo ajusto para
   que pase».
6. **Dependencias**: si necesita una TASK previa, una decisión del owner, una credencial o una
   migración.

### Fase 3 — Entender las invariantes antes de implementar

No se escribe código hasta poder contestar: *¿qué propiedad tiene que seguir siendo verdad después de
mi cambio?* Si la TASK toca dinero, la respuesta es obligatoria y va escrita (ver la skill
`money-change`).

Recién entonces se escribe el **test rojo** y se implementa.

---

## 2. Decision gate

Contestar las cinco preguntas. Si alguna queda sin respuesta, la TASK no arranca.

| Puerta | Pregunta | Qué la responde |
|---|---|---|
| **SCOPE** | ¿Qué cambia exactamente? | Scope IN / Scope OUT escritos |
| **RISK** | ¿Toca dinero, auth, datos, migraciones, infraestructura o producción? | Clase de riesgo + skill que se activa |
| **TEST** | ¿Qué prueba va a demostrar que está correcto? | Test rojo nombrado antes de implementar |
| **DONE** | ¿Qué evidencia objetiva cierra la TASK? | Criterios de aceptación + comandos de validación |
| **RECORD** | ¿Qué merece entrar en `MEMORY.md` y qué solo pertenece al historial? | Una línea: lección reutilizable vs. detalle de la tarea |

**Clase de riesgo** = la más alta que aplique (una TASK que toca dinero y UI es de riesgo *dinero*):

| Clase | Dispara |
|---|---|
| Dinero | `money-change` (invariantes, transacción, concurrencia, idempotencia, auditoría) |
| Auth / datos sensibles | `security-change` |
| Esquema / migración | `database-migration` |
| UI | `ui-change` (design system, 375/1280, screenshots) |
| Solo documentación o CI | Validación estándar |

---

## 3. Checklist de arranque

- [ ] `git status` limpio y rama propia creada **desde `main` actualizado** (BASE MAIN anotada).
- [ ] Leí `AGENTS.md`, `CONTEXT.md` y `ops/CURRENT.md`.
- [ ] Leí la TASK y la skill que corresponde a su clase de riesgo.
- [ ] Identifiqué el bounded context.
- [ ] Declaré riesgos, Scope IN y Scope OUT.
- [ ] Identifiqué tests existentes afectados y si alguno cambia (con justificación).
- [ ] Identifiqué dependencias y bloqueos.
- [ ] Contesté SCOPE / RISK / TEST / DONE / RECORD.
- [ ] Sé cuál es el **test rojo** que voy a escribir primero.
- [ ] Todavía **no** implementé nada.

---

## 4. Cuándo parar y preguntar

Solo ante: decisión de **producto** no definida que cambie comportamiento visible · operación
destructiva contra producción · credenciales externas no disponibles · dependencia nueva que cambie
significativamente el stack · migración destructiva de datos · contradicción imposible entre una
instrucción del owner y una restricción técnica real · permisos de GitHub que impiden push o PR.

Todo lo demás (nombres, formato, ubicación de documentos, decisiones ya inferibles del repo) se
**resuelve y se sigue**.
