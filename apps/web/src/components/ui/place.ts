export type AnchorRect = { left: number; top: number; bottom: number };

/** Coloca un elemento flotante bajo el ancla, o encima si no cabe (como en el prototipo). */
export function placeFloating(el: HTMLElement, r: AnchorRect) {
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const h = el.offsetHeight;
  const w = el.offsetWidth;
  el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
  el.style.top = `${r.bottom + h + 8 < vh ? r.bottom + 6 : Math.max(8, r.top - h - 6)}px`;
}
