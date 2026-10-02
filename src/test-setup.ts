import { configure } from "@testing-library/dom";

/**
 * jsdom no implementa el **modo modal** del `<dialog>`: tiene el elemento y el atributo `open`, pero
 * `showModal()` no existe. Sin este mínimo, cualquier componente que use el primitivo `Modal` —que es la
 * forma correcta de un diálogo en el panel— revienta en jsdom con `dialog.showModal is not a function` y el
 * test falla por el entorno, no por el código.
 *
 * El relleno hace las **dos** cosas que el navegador hace al abrir en modo modal y que los tests necesitan:
 * marca `open` y emite el `cancel` cuando llega un **Escape**. Sin lo segundo, un `keyboard("{Escape}")` de
 * testing-library se perdería: el evento se despacha en el elemento enfocado —que puede no estar dentro del
 * diálogo— y jsdom no tiene la maquinaria del modo modal que lo redirige.
 *
 * Es el **mismo** relleno que `src/shared/ui/modal.test.tsx` hacía por su cuenta; vive acá para que los
 * consumidores (el panel operacional del POS, el modo «pedido existente») puedan probarse sin repetirlo. Lo
 * que importa de verdad —el foco atrapado y el `::backdrop`— es del navegador y se comprueba en el E2E.
 */
if (typeof window !== "undefined" && typeof window.HTMLDialogElement === "function") {
  const proto = window.HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    close?: () => void;
  };

  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };

  proto.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;

      const openDialog = document.querySelector<HTMLDialogElement>("dialog[open]");
      if (!openDialog) return;

      openDialog.dispatchEvent(new Event("cancel", { bubbles: false, cancelable: true }));
    },
    true,
  );
}

/**
 * Ajustes globales de los tests de DOM (jsdom).
 *
 * `asyncUtilTimeout` es cuánto esperan `findBy*` y `waitFor` a que aparezca algo. El
 * default de testing-library es **1000 ms**, y en un runner de CI cargado no alcanza:
 * dos tests de `/admin/promotions` pasaron en la máquina de desarrollo y fallaron en
 * CI porque el render posterior al `fetch` tardó más que eso. Subirlo solo hace que
 * una espera legítima tenga más margen; un test que de verdad falla sigue fallando,
 * solo tarda un poco más en decirlo.
 *
 * Este valor tiene que quedar **por debajo** de `testTimeout` (20 s, en
 * `vitest.config.ts`): si la espera dura lo mismo que el presupuesto del test, vitest
 * mata el test antes de que la espera pueda fallar con un mensaje útil, y eso fue
 * exactamente el segundo redondo de este mismo problema.
 *
 * Los tests que esperan un resultado **visible** (un aviso, una fila) siguen siendo la
 * forma preferida: esperar un efecto de la UI es más honesto que esperar el mock.
 */
configure({ asyncUtilTimeout: 5000 });
