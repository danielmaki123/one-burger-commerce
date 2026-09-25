# CONTENT.md — ley de contenido y lenguaje de interfaz

**Qué es**: cómo se escribe la interfaz de One Burger. Aplica a todo texto visible: títulos, labels,
botones, ayudas, errores, estados vacíos, confirmaciones y notificaciones.

**Ley central**:

> Si una interacción normal necesita un párrafo para entenderse, primero se **rediseña la interacción**.

La interfaz comunica por **posición, jerarquía, agrupación, label, estado, número, iconografía y feedback**
antes de añadir explicación. El texto es el último recurso, no el primero.

Idioma: **español**, con el vocabulario del negocio (`C$`/`NIO` por la moneda configurada, `+505`, retiro,
turno, arqueo, comanda, cierre). Nunca un término técnico donde existe uno del oficio.

---

## 1. Presupuesto de texto por arquetipo

| Arquetipo | Título | Subtítulo | Texto de apoyo | Ayuda |
|---|---|---|---|---|
| **Dashboard / Overview** | 1 línea | 0–1 línea | **ausente** | solo si cambia la interpretación |
| **Operational** (POS, KDS, Caja) | 1 línea | 0 líneas | ausente | solo si evita un error |
| **Management** (Usuarios, Menú, Locales) | 1 línea | 0–1 línea | ausente | si evita error |
| **Configuration** | 1 línea | 0–1 línea | permitido, corto | permitido |
| **Detail** | 1 línea | 0–1 línea | permitido | si evita error |

**Prohibido el apilado**: título + subtítulo + descripción + hint + caption juntos en la misma cabecera.
Si hay que decir cinco cosas antes de mostrar el dato, el problema es el diseño, no la cantidad de texto.

Ejemplos del negocio:

```text
BIEN   Turno abierto · Desde 14:05 · Camino de Oriente
MAL    Aquí podés ver la información del turno actual, incluyendo la hora
       de apertura y la sucursal en la que se está trabajando.

BIEN   C$ 1.240,00        C$ 0,00 de diferencia
MAL    Total esperado en caja según los movimientos registrados: C$ 1.240,00
```

---

## 2. Títulos

- **Título de página**: qué es la pantalla, en 1–3 palabras del oficio (*Turno*, *Órdenes*, *Menú*,
  *Usuarios*, *Cierres*). Sin gerundios, sin "Gestión de", sin "Administración de".
- **Título de sección**: agrupa, no repite (*Efectivo*, *Transferencias*, *Devoluciones*).
- **Nunca un título que sea una instrucción** ("Hacé clic acá para ver…").
- Sentence case en español: solo la primera palabra en mayúscula. MAYÚSCULAS quedan para las etiquetas
  (`text-st-overline`, `text-label`), no para frases.

---

## 3. Labels y campos

- Un **label** por control, siempre visible, asociado al input (`htmlFor`/`id`), sin placeholder como sustituto.
- El label dice **qué es el dato**, no cómo escribirlo (*Teléfono*, no *Ingresá tu teléfono*).
- Placeholder: solo un **ejemplo** de formato, nunca la instrucción.
- Unidades y formato en el propio control o en su sufijo (*C$*, *%*), no en el label.

---

## 4. Helper text: cuándo SÍ

Solo cuando cumple una de estas cuatro funciones:

1. explica un **formato no evidente**;
2. **evita un error** real;
3. explica una **consecuencia importante** (afecta plata, caja o datos de clientes);
4. comunica una **restricción** (límite, horario, alcance).

Todo lo demás se elimina. Si el helper repite el label o describe lo que ya se ve, sobra.

---

## 5. Botones y acciones

**Verbo + objeto**, en imperativo y en español:

```text
BIEN   Crear usuario · Guardar cambios · Cerrar turno · Reembolsar pago · Anular cobro
MAL    Aceptar · Continuar · Procesar · Ejecutar · OK · Enviar
```

- Una **acción primaria** por contexto visual (ver
  [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §9).
- Acciones destructivas dicen el objeto y la consecuencia (*Anular cobro*, no *Confirmar*), y piden
  confirmación cuando el efecto es irreversible.
- **Prohibido** el botón + frase que explica lo mismo ("Guardar cambios" + "Se guardarán los cambios").
- Botón de icono: `aria-label` con la misma frase que tendría el label visible.

---

## 6. Errores

- **Inline y concretos**, en el campo que falla, asociados con `aria-describedby`.
- Dicen **qué pasó y qué hacer**, sin culpar al usuario ni mostrar códigos internos:
  `BIEN  El monto no puede superar el saldo pendiente (C$ 320,00).`
  `MAL   Error de validación: INVALID_AMOUNT.`
- Un error de sistema (500, red) se informa **una vez**, arriba, con la acción disponible (*Reintentar*), y
  **no** se disfraza de error de campo.
- Un error de permiso dice la verdad: no se puede, y a quién pedirle (sin detallar la política interna).
- Nunca se inventa el motivo de un fallo: si no se sabe, se dice que no se sabe.

---

## 7. Estados vacíos

Un estado vacío responde **tres** cosas, en este orden y en lo posible sin párrafo:

1. **qué no hay** ("Sin cierres todavía");
2. **por qué** (solo si aporta: "cuando cierres el primer turno aparece acá");
3. **qué hacer** (la acción primaria, si existe y el usuario puede hacerla).

Prohibido: vacíos decorativos con ilustración grande y cero acción, y vacíos que dicen "No hay datos" sin
decir si eso es normal, si falta un filtro o si hay un error.

---

## 8. Confirmaciones destructivas

- Nombran el objeto concreto y su magnitud: *Anular el cobro de C$ 500,00 del pedido #1042?*
- El botón de confirmación **repite el verbo** de la acción, no "Sí".
- Si la acción es irreversible, se dice en una línea. Si es reversible, no se dramatiza.
- Nunca se usa un `window.confirm` genérico: hay primitivo (`Modal`).

---

## 9. Progressive disclosure

La información secundaria o avanzada **no** se muestra permanentemente. Va a:

`tooltip` · `details` · `popover` · `sheet` · `drawer` · `modal` · ruta secundaria.

Regla para elegir: si el usuario **no puede terminar la tarea** sin ese dato, vive en la pantalla; si lo
necesita **a veces**, va detrás de una interacción; si es **referencia**, va a una ruta secundaria.

Un formulario largo de administración se abre en **sheet/drawer**, no se deja siempre abierto empujando la
lista (ver [`PATTERNS.md`](PATTERNS.md) § Management).

---

## 10. Densidad verbal

- **Cero copy decorativo**: ninguna frase que no cambie una decisión o evite un error.
- **Cero instrucciones obvias** ("Seleccioná una opción para continuar").
- Una línea por idea; dos es el máximo antes de preguntarse si el diseño está mal.
- Números con formato consistente y **una sola fuente** para calcularlos (la que ya usa el backend).
- Nunca se promete un dato que el backend no puede sostener: si no existe, el texto no miente
  (ver [`DATA_VISUALIZATION.md`](DATA_VISUALIZATION.md) §7).

---

## 11. Microcopy de sistema

- Estados del pedido, del turno y de caja usan **el vocabulario del sistema**, no sinónimos libres
  (`Nueva`, `Preparando`, `Lista`, `Cerrada`, `Alerta`; `Pendiente`, `Preparación`, `Listo`, `SLA`).
- Los mensajes de éxito son cortos y no interrumpen: *Cambios guardados*, *Turno cerrado*.
- Las alertas del negocio (Telegram/admin) siguen la misma ley: qué pasó, dónde y cuánto — sin adjetivos.

---

## 12. Qué NO decide este documento

Los **datos** de una pantalla (qué KPI, qué columnas, qué comparaciones) son de la spec de esa pantalla
([`screens/TEMPLATE.md`](screens/TEMPLATE.md)) y de la arquitectura de producto; este documento decide **cómo
se escribe** lo que esa spec ya eligió mostrar.
