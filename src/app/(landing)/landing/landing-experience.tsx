"use client";

import { useEffect, useRef, useState } from "react";

import {
  LANDING_FRAME_NUMBERS,
  framePathForIndex,
  resolveFrameIndex,
  resolveScrollProgress,
  shouldRevealMenuButton,
} from "@/modules/landing/domain/landing-frames";

type LandingExperienceProps = {
  /** A dónde lleva el botón: la app de pedidos. */
  menuUrl: string;
  menuLabel: string;
  /** Para lectores de pantalla y buscadores; no cambia el diseño del mock. */
  brandName: string;
  /** Cuántos frames precargar por delante del actual. */
  preloadAhead?: number;
};

/**
 * Landing con la hamburguesa que avanza al hacer scroll.
 *
 * Portado del mock aprobado, con tres diferencias deliberadas: el botón MENU se
 * revela recién al terminar la animación (pedido del owner), `prefers-reduced-motion`
 * deja un frame fijo y muestra el botón enseguida, y la secuencia se precarga de
 * forma progresiva para que el scrubbing no se trabe.
 */
export function LandingExperience({
  menuUrl,
  menuLabel,
  brandName,
  preloadAhead = 8,
}: LandingExperienceProps) {
  const stageRef = useRef<HTMLElement | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [menuRevealed, setMenuRevealed] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const preloadedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      // Sin animación no hay nada que esperar: el botón no puede quedar detrás
      // de un scroll largo que ya no muestra nada.
      setMenuRevealed(true);
      return;
    }

    let ticking = false;
    let lastIndex = -1;
    let lastRevealed = false;

    function preloadFrame(index: number) {
      if (preloadedRef.current.has(index)) return;
      preloadedRef.current.add(index);

      const image = new Image();
      // Las precargas no pueden competir con la frame que el cliente está
      // mirando: en datos lentos le robaban el ancho de banda y la primera
      // imagen tardaba 11 s en aparecer.
      image.fetchPriority = "low";
      image.src = framePathForIndex(index);
    }

    function preloadAround(index: number) {
      const end = Math.min(LANDING_FRAME_NUMBERS.length - 1, index + preloadAhead);

      for (let i = index; i <= end; i += 1) {
        preloadFrame(i);
      }
    }

    function render() {
      ticking = false;
      if (!stage) return;

      const rect = stage.getBoundingClientRect();
      const progress = resolveScrollProgress({
        stageTop: rect.top,
        stageHeight: rect.height,
        viewportHeight: window.innerHeight,
      });
      const nextIndex = resolveFrameIndex(progress);
      const reveal = shouldRevealMenuButton(progress);

      if (progress > 0.01) setHasScrolled(true);

      if (nextIndex !== lastIndex) {
        lastIndex = nextIndex;
        setFrameIndex(nextIndex);
        preloadAround(nextIndex);
      }

      if (reveal !== lastRevealed) {
        lastRevealed = reveal;
        setMenuRevealed(reveal);
      }
    }

    function requestRender() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(render);
    }

    // La precarga arranca recién cuando la primera frame terminó de cargar, así
    // el ancho de banda inicial es para lo único que el cliente ve.
    const visibleFrame = document.getElementById("landing-frame") as HTMLImageElement | null;

    if (visibleFrame?.complete) {
      // Si llegó de caché, `load` ya no se dispara y el póster quedaría encima.
      setFirstFrameReady(true);
    }

    const firstFrameReady =
      visibleFrame && !visibleFrame.complete
        ? new Promise<void>((resolve) => {
            visibleFrame.addEventListener("load", () => resolve(), { once: true });
            visibleFrame.addEventListener("error", () => resolve(), { once: true });
          })
        : Promise.resolve();

    void firstFrameReady.then(() => preloadAround(0));

    render();
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender);

    return () => {
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
    };
  }, [preloadAhead]);

  return (
    <div className="landing-shell">
      <h1 className="sr-only">{brandName}</h1>

      <main
        className="landing-stage"
        id="landing-stage"
        ref={stageRef}
        aria-label={`Animación de ${brandName}`}
      >
        <section className="landing-scene" data-loaded={firstFrameReady}>
          {/* Póster borroso de la primera frame: se ve al instante mientras la
              imagen real viaja, así el cliente nunca mira una pantalla negra. */}
          <div className="landing-poster" aria-hidden="true" />
          <img
            className="landing-frame"
            id="landing-frame"
            src={framePathForIndex(frameIndex)}
            alt=""
            aria-hidden="true"
            width={720}
            height={1280}
            fetchPriority="high"
            decoding="async"
            onLoad={() => setFirstFrameReady(true)}
          />
        </section>
      </main>

      {/* Ayuda para saber que hay que scrollear. Es decorativa: a un lector de
          pantalla no le aporta nada, así que queda fuera del árbol. */}
      <p className="landing-scroll-hint" data-visible={!hasScrolled} aria-hidden="true">
        Deslizá
      </p>

      <a
        className="landing-menu-button"
        href={menuUrl}
        aria-label={menuLabel}
        data-revealed={menuRevealed}
      >
        {menuLabel}
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="landing-menu-button__arrow"
        >
          <path d="M5 12h13" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}
