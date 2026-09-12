import { configure } from "@testing-library/dom";

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
