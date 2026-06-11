import { useEffect, useRef } from "react";

export function useMagnetic<T extends HTMLElement>(strength = 0.28) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(hover: none)").matches) return; // no-op on touch

    let rafId = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;

    function onMove(e: MouseEvent) {
      const r    = el!.getBoundingClientRect();
      const ecx  = r.left + r.width  / 2;
      const ecy  = r.top  + r.height / 2;
      const dist = Math.hypot(e.clientX - ecx, e.clientY - ecy);
      const max  = Math.max(r.width, r.height) * 1.8;
      if (dist < max) {
        tx = (e.clientX - ecx) * strength;
        ty = (e.clientY - ecy) * strength;
      } else {
        tx = 0; ty = 0;
      }
    }

    function onLeave() { tx = 0; ty = 0; }

    function tick() {
      cx += (tx - cx) * 0.14;
      cy += (ty - cy) * 0.14;
      el!.style.transform = `translate(${cx.toFixed(2)}px,${cy.toFixed(2)}px)`;
      rafId = requestAnimationFrame(tick);
    }

    document.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    el.style.willChange = "transform";
    rafId = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(rafId);
      el.style.transform = "";
      el.style.willChange = "";
    };
  }, [strength]);

  return ref;
}
