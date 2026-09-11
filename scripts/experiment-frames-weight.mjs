/* global Image, document */
/**
 * ¿Cuánto se puede adelgazar la secuencia de frames sin que se note?
 *
 * Compara tamaños de salida y mide la diferencia de píxeles contra el original.
 * Solo lee las fuentes: escribe en /tmp para medir, no toca `public/`.
 *
 * Uso: node scripts/experiment-frames-weight.mjs
 */
import { readFileSync } from "node:fs";

import { chromium } from "@playwright/test";

const sample = ["burger_0045", "burger_0060", "burger_0120"];
const variants = [
  { label: "original", width: 0, quality: 0 },
  { label: "720 q0.6", width: 720, quality: 0.6 },
  { label: "540 q0.65", width: 540, quality: 0.65 },
  { label: "480 q0.7", width: 480, quality: 0.7 },
  { label: "480 q0.55", width: 480, quality: 0.55 },
];

const payload = sample.map((name) => ({
  name,
  dataUri: `data:image/webp;base64,${readFileSync(`public/landing/frames/${name}.webp`).toString("base64")}`,
}));

const browser = await chromium.launch();
const page = await browser.newPage();

const results = await page.evaluate(
  async ([items, sizes]) => {
    function loadImage(uri) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("no cargó"));
        image.src = uri;
      });
    }

    function pixels(image, width, height) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);
      return context.getImageData(0, 0, width, height).data;
    }

    function meanAbsoluteError(a, b) {
      let sum = 0;
      const channels = Math.min(a.length, b.length);
      for (let i = 0; i < channels; i += 4) {
        sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      }
      return sum / ((channels / 4) * 3 * 255);
    }

    const out = {};

    for (const size of sizes) {
      let bytes = 0;
      let error = 0;

      for (const item of items) {
        const original = await loadImage(item.dataUri);
        const compareWidth = size.width || original.naturalWidth;
        const compareHeight = Math.round(
          original.naturalHeight * (compareWidth / original.naturalWidth),
        );
        const reference = pixels(original, compareWidth, compareHeight);

        let uri = item.dataUri;
        if (size.width) {
          const canvas = document.createElement("canvas");
          canvas.width = size.width;
          canvas.height = Math.round(
            original.naturalHeight * (size.width / original.naturalWidth),
          );
          canvas.getContext("2d").drawImage(original, 0, 0, canvas.width, canvas.height);
          uri = canvas.toDataURL("image/webp", size.quality);
        }

        bytes += Math.round((uri.length - uri.indexOf(",") - 1) * 0.75);
        const encoded = await loadImage(uri);
        error += meanAbsoluteError(reference, pixels(encoded, compareWidth, compareHeight));
      }

      out[size.label] = {
        kbPromedio: Math.round(bytes / items.length / 1024),
        kbSecuencia37: Math.round((bytes / items.length / 1024) * 37),
        diferenciaPromedioPorciento: Math.round((error / items.length) * 1000) / 10,
      };
    }

    return out;
  },
  [payload, variants],
);

await browser.close();

console.log(JSON.stringify(results, null, 2));
console.log("\nsecuencia completa de 37 frames, peso actual: 3,26 MB");
