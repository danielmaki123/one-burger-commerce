import * as React from "react";

interface ModalProps {
  open: boolean;
  /** Se llama al cerrar: Escape, click de fondo o acción del contenido. */
  onClose: () => void;
  /** Título visible, que además nombra el diálogo para el lector de pantalla. */
  title: string;
  /**
   * Ancho máximo. Por defecto, el de las hojas de edición del panel.
   *
   * `full` es el de las superficies **operativas** que necesitan el ancho de la pantalla (el panel
   * operacional del POS y el modo «pedido existente», `TASK-ORDER-POS-OPERATIONAL-006`): casi todo el
   * viewport, con su propio scroll interno. Existe acá y no como un diálogo declarado a mano porque el
   * guardrail `manual-aria-role` lo prohíbe y porque el foco atrapado, el Escape y la semántica son
   * exactamente lo que este primitivo ya resuelve.
   */
  size?: "sm" | "lg" | "full";
  /** Identificador de test del `<dialog>`, para las superficies que el E2E tiene que localizar. */
  testId?: string;
  /**
   * El nombre accesible del botón de cierre. Por defecto «Cerrar»; una superficie puede querer decir **qué**
   * cierra («Cerrar panel», «Cerrar pedido») para que dos capas de la misma pantalla no compartan nombre.
   */
  closeLabel?: string;
  /**
   * Abrir como **capa** en vez de como modal: el `<dialog>` queda `open` sin `showModal()`, así que el
   * contenido de atrás **sigue siendo accionable**. Lo usa el panel operacional del POS, donde el cajero
   * cambia de modo pulsando otro contador de la banda (brief §21). Un modal bloquea eso a propósito.
   */
  layered?: boolean;
  children: React.ReactNode;
}

/**
 * Los anchos, por tamaño. `full` sale del `max-w` del resto: usa el viewport menos un margen, que es lo que
 * necesita un panel de operación con filas y columnas.
 */
const SIZES = {
  sm: "max-w-sm",
  lg: "max-w-lg",
  full: "max-w-[min(72rem,calc(100vw-2rem))]",
} as const;

/**
 * C1-1 de `plan2uiux.md` — el `Modal` que faltaba.
 *
 * Hoy el panel tiene **3 `role="dialog"` escritos a mano** (la hoja de edición, la navegación móvil y
 * el diálogo de mover subcategoría) y 3 `window.confirm` para las confirmaciones. La copia a mano es
 * donde se pierde el foco: una de las tres no tiene focus trap ni Escape.
 *
 * Se apoya en el `<dialog>` **nativo**: el navegador da el modo modal (`::backdrop`), el foco
 * atrapado, el `Escape` (evento `cancel`) y la semántica de diálogo; nada de eso se reimplementa con
 * `div`s y `tabIndex`. El `aria-labelledby` apunta al `<h2>` del título.
 *
 * No se cierra solo: el estado lo tiene la pantalla, así que `onClose` es la única puerta y el
 * diálogo no se cierra "por su cuenta" en un doble render.
 *
 * `m-auto` es del `dialog:modal` del navegador (`inset: 0` + `margin: auto` = centrado): el reset de
 * Tailwind (`* { margin: 0 }`) lo borraba y el diálogo aparecía **pegado a la esquina** —visto en el POS,
 * que es donde se capturó—. Sin eso, el modo modal del navegador no alcanza.
 */
export function Modal({
  open,
  onClose,
  title,
  size = "lg",
  testId,
  closeLabel = "Cerrar",
  layered = false,
  children,
}: ModalProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  /**
   * `TASK-ORDER-POS-OPERATIONAL-006` (brief §21) — **capa, no trampa**.
   *
   * El panel operacional del POS tiene que dejar la banda de KPI **accionable** mientras está abierto: el
   * cajero cambia de modo pulsando otro contador, y el panel es el **mismo** componente con otro filtro. Con
   * `showModal()` el navegador pone una barrera de punteros y esas pulsaciones se pierden —el spec E2E lo
   * midió: `<dialog …> intercepts pointer events`—, así que un panel **por capas** se abre con el atributo
   * `open` y conserva su semántica de `dialog` sin la barrera. El modo **modal** sigue siendo el default: es
   * lo correcto para las hojas de edición y las confirmaciones, donde no hay nada detrás que tocar.
   *
   * La `role` explícita existe sólo acá, en el primitivo: el guardrail `manual-aria-role` prohíbe declararla
   * a mano en una pantalla, no en el componente que **es** el diálogo.
   */
  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }

    if (layered) {
      if (!dialog.open) dialog.setAttribute("open", "");
      return;
    }

    if (!dialog.open) dialog.showModal();
  }, [open, layered]);

  return (
    <dialog
      ref={ref}
      {...(testId ? { "data-testid": testId } : {})}
      {...(layered ? { role: "dialog" } : {})}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      /**
       * El `cancel` del `<dialog>` **es** el camino del navegador para Escape, y es el que se conserva como
       * autoridad. Además se escucha `keydown`: algunos entornos (jsdom en los tests de componente) no emiten
       * `cancel`, y sin esto la misma pulsación se comportaría distinto en un test y en el navegador.
       */
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      onClick={(event) => {
        // El click de fondo llega con `target === dialog` (el contenido es un hijo). Así se puede
        // cerrar sin un overlay propio ni un listener global.
        if (event.target === ref.current) onClose();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${SIZES[size]} rounded-panel border border-border bg-card p-5 text-foreground shadow-raised backdrop:bg-coal/40`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id={titleId} className="font-heading text-headline-md text-foreground">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="shrink-0 rounded-md p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {children}
    </dialog>
  );
}
