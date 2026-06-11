import { useEffect, useRef } from "react";

interface Ring { x: number; y: number; r: number; alpha: number }

// Renders water-drop ripples that follow the cursor — only on non-touch devices.
// Mount inside any `relative overflow-hidden` container.
export default function RippleCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;

    const canvas = canvasRef.current as HTMLCanvasElement;
    const ctx    = canvas.getContext("2d") as CanvasRenderingContext2D;
    const rings: Ring[] = [];
    let   rafId  = 0;

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function onMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      // only react when cursor is inside this element
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom
      ) return;
      rings.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, r: 0, alpha: 0.55 });
      if (rings.length > 10) rings.shift();
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = rings.length - 1; i >= 0; i--) {
        const rp = rings[i];
        rp.r     += 2;
        rp.alpha -= 0.014;
        if (rp.alpha <= 0) { rings.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(62,200,144,${rp.alpha.toFixed(3)})`;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }
      rafId = requestAnimationFrame(draw);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("mousemove", onMove);
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 20,
        display: "block",
      }}
    />
  );
}
