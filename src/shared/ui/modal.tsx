import * as React from "react";

interface ModalProps {
  open: boolean;
  /** Se llama al cerrar: Escape, click de fondo o acción del contenido. */
  onClose: () => void;
  /** Título visible, que además nombra el diálogo para el lector de pantalla. */
  title: string;
  /** Ancho máximo. Por defecto, el de las hojas de edición del panel. */
  size?: "sm" | "lg";
  children: React.ReactNode;
}

const SIZES = { sm: "max-w-sm", lg: "max-w-lg" } as const;

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
export function Modal({ open, onClose, title, size = "lg", children }: ModalProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
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
          aria-label="Cerrar"
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
