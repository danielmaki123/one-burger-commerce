/**
 * Genera un póster mínimo (base64) a partir de la primera frame, para que el
 * landing muestre algo mientras carga la imagen real.
 *
 * Uso: node scripts/make-landing-poster.mjs
 */
/* global Image, document */
import { readFileSync, writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

const source = "public/landing/frames/burger_0045.webp";
const bytes = readFileSync(source);
const dataUri = `data:image/webp;base64,${bytes.toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage();

const poster = await page.evaluate(
  ([uri, width]) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const scale = width / image.naturalWidth;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = Math.round(image.naturalHeight * scale);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.45));
      };
      image.onerror = () => reject(new Error("no se pudo cargar la frame"));
      image.src = uri;
    }),
  [dataUri, 24],
);

await browser.close();

writeFileSync("scripts/.landing-poster.txt", poster);
console.log(`póster: ${poster.length} caracteres (${Math.round(poster.length / 1024)} KB de HTML)`);
console.log(`origen: ${Math.round(bytes.length / 1024)} KB`);
