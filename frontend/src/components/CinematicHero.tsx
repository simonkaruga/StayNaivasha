import { useEffect, useRef } from "react";

interface Cloud   { x: number; y: number; s: number; spd: number }
interface Sparkle { x: number; y: number; phase: number; spd: number }
interface Bird    { x: number; y: number; vx: number; vy: number; phase: number }

export default function CinematicHero({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    let W = 0, H = 0, t = 0, animId = 0, lastTs = 0;
    const clouds: Cloud[]   = [];
    const sparks: Sparkle[] = [];
    const birds:  Bird[]    = [];

    function resize() {
      const dpr = Math.min(devicePixelRatio, 2);
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildEntities();
    }

    function buildEntities() {
      clouds.length = sparks.length = birds.length = 0;
      for (let i = 0; i < 6; i++) {
        clouds.push({
          x:   Math.random() * W * 1.4,
          y:   H * (0.05 + Math.random() * 0.20),
          s:   0.55 + Math.random() * 0.85,
          spd: 0.04 + Math.random() * 0.07,
        });
      }
      for (let i = 0; i < 38; i++) {
        sparks.push({
          x:     Math.random() * W,
          y:     H * (0.60 + Math.random() * 0.20),
          phase: Math.random() * Math.PI * 2,
          spd:   1.0 + Math.random() * 1.8,
        });
      }
      for (let i = 0; i < 5; i++) {
        birds.push({
          x:     Math.random() * W,
          y:     H * (0.06 + Math.random() * 0.22),
          vx:    0.10 + Math.random() * 0.10,
          vy:    (Math.random() - 0.5) * 0.03,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    function drawCloud(x: number, y: number, s: number, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = "rgba(180,215,245,0.45)";
      ctx.shadowBlur  = 14 * s;
      ctx.fillStyle   = "rgba(255,255,255,0.94)";
      const parts: [number, number, number][] = [
        [0, 0, 24], [-30, 9, 18], [30, 9, 18],
        [-14, -11, 16], [14, -11, 16], [0, -16, 13],
      ];
      ctx.beginPath();
      for (const [cx, cy, r] of parts) ctx.arc(x + cx * s, y + cy * s, r * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawHippo(x: number, y: number, s: number) {
      ctx.save();
      ctx.translate(x, y);

      // back above waterline
      ctx.fillStyle = "#5a6a55";
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * s, 7 * s, 0, Math.PI, 0);
      ctx.fill();

      // head
      ctx.fillStyle = "#627060";
      ctx.beginPath();
      ctx.ellipse(-13 * s, -2 * s, 8 * s, 5.5 * s, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // nostrils
      ctx.fillStyle = "#3d4a3a";
      ctx.beginPath();
      ctx.ellipse(-16 * s, -4 * s, 1.5 * s, 1 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(-11 * s, -4 * s, 1.5 * s, 1 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // ears
      ctx.fillStyle = "#5a6a55";
      [[-18, -7], [-8, -7]].forEach(([ex, ey]) => {
        ctx.beginPath();
        ctx.arc(ex * s, ey * s, 2.5 * s, 0, Math.PI * 2);
        ctx.fill();
      });

      // eyes
      ctx.fillStyle = "#1a1a0a";
      [[-17, -6], [-10, -6]].forEach(([ex, ey]) => {
        ctx.beginPath();
        ctx.arc(ex * s, ey * s, 1.2 * s, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      const LY = H * 0.62; // where hills end / lake begins
      const SY = H * 0.86; // shore bottom

      // ── Sky ─────────────────────────────────────────────────────────────
      const sky = ctx.createLinearGradient(0, 0, 0, LY);
      sky.addColorStop(0,   "#2a62b8");
      sky.addColorStop(0.3, "#4a8eca");
      sky.addColorStop(0.7, "#78b8de");
      sky.addColorStop(1,   "#b8ddf5");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, LY);

      // ── Sun ─────────────────────────────────────────────────────────────
      const SX = W * 0.74, SYs = H * 0.10;
      const sg = ctx.createRadialGradient(SX, SYs, 0, SX, SYs, H * 0.32);
      sg.addColorStop(0,   `rgba(255,248,200,${0.52 + 0.08 * Math.sin(t * 0.28)})`);
      sg.addColorStop(0.3, "rgba(255,235,160,0.18)");
      sg.addColorStop(1,   "transparent");
      ctx.fillStyle = sg;
      ctx.fillRect(SX - H * 0.32, SYs - H * 0.32, H * 0.64, H * 0.64);
      ctx.save();
      ctx.shadowColor = "rgba(255,230,100,0.85)";
      ctx.shadowBlur  = 22;
      ctx.fillStyle   = "rgba(255,252,210,0.96)";
      ctx.beginPath(); ctx.arc(SX, SYs, H * 0.032, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // ── Clouds ──────────────────────────────────────────────────────────
      for (const c of clouds) {
        c.x -= c.spd;
        if (c.x < -220 * c.s) c.x = W + 120 * c.s;
        drawCloud(c.x, c.y, c.s, 0.68 + 0.28 * (1 - c.y / (H * 0.26)));
      }

      // ── Horizon haze ─────────────────────────────────────────────────────
      const hz = ctx.createLinearGradient(0, LY - H * 0.07, 0, LY + H * 0.05);
      hz.addColorStop(0,   "transparent");
      hz.addColorStop(0.5, "rgba(200,232,250,0.38)");
      hz.addColorStop(1,   "transparent");
      ctx.fillStyle = hz; ctx.fillRect(0, LY - H * 0.07, W, H * 0.12);

      // ── Far hills ───────────────────────────────────────────────────────
      ctx.fillStyle = "#8abd65";
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, LY + H * 0.02);
      for (let i = 0; i <= 22; i++) {
        const x = (i / 22) * W;
        const n = Math.sin(x * 0.008) * 0.06 + Math.sin(x * 0.016) * 0.03;
        ctx.lineTo(x, LY + H * (0.02 - n));
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

      // ── Mid hills ───────────────────────────────────────────────────────
      ctx.fillStyle = "#5c9c3a";
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, LY + H * 0.04);
      for (let i = 0; i <= 36; i++) {
        const x = (i / 36) * W;
        const n = Math.sin(x * 0.013 + 0.5) * 0.072
                + Math.sin(x * 0.030 + 1.1) * 0.042
                + Math.sin(x * 0.058) * 0.020;
        ctx.lineTo(x, LY + H * (0.04 - Math.max(0, n) * 1.15));
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

      // ── Near treeline ───────────────────────────────────────────────────
      ctx.fillStyle = "#2e6418";
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, LY - H * 0.01);
      for (let i = 0; i <= 52; i++) {
        const x = (i / 52) * W;
        const n = Math.sin(x * 0.021 + 0.3) * 0.078
                + Math.sin(x * 0.054 + 1.2) * 0.052
                + Math.sin(x * 0.102 + 0.7) * 0.030;
        ctx.lineTo(x, LY - H * (Math.max(0, n) * 1.25));
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

      // ── Lake ────────────────────────────────────────────────────────────
      const lake = ctx.createLinearGradient(0, LY, 0, SY);
      lake.addColorStop(0,   "#5ccfe2");
      lake.addColorStop(0.4, "#42bcd0");
      lake.addColorStop(1,   "#2ca0b4");
      ctx.fillStyle = lake; ctx.fillRect(0, LY, W, SY - LY);

      // sky reflection at top of lake
      const refl = ctx.createLinearGradient(0, LY, 0, LY + H * 0.07);
      refl.addColorStop(0, "rgba(168,224,252,0.52)");
      refl.addColorStop(1, "transparent");
      ctx.fillStyle = refl; ctx.fillRect(0, LY, W, H * 0.07);

      // sun reflection streak
      ctx.save();
      ctx.filter = `blur(${5 + 2.5 * Math.sin(t * 0.75)}px)`;
      const rw  = 16 + 16 * Math.abs(Math.sin(t * 0.52));
      const rx  = SX + Math.sin(t * 1.1) * 5;
      const rfg = ctx.createLinearGradient(0, LY, 0, SY);
      rfg.addColorStop(0,   `rgba(255,248,200,${0.65 + 0.15 * Math.sin(t * 0.7)})`);
      rfg.addColorStop(0.4, "rgba(255,230,140,0.25)");
      rfg.addColorStop(1,   "transparent");
      ctx.fillStyle = rfg;
      ctx.fillRect(rx - rw / 2, LY, rw, SY - LY);
      ctx.restore();

      // water sparkles
      for (const sp of sparks) {
        const a = 0.35 + 0.60 * Math.abs(Math.sin(t * sp.spd + sp.phase));
        if (a < 0.12) continue;
        ctx.save();
        ctx.shadowColor = "rgba(255,255,255,0.9)";
        ctx.shadowBlur  = 6;
        ctx.globalAlpha = a;
        ctx.fillStyle   = "#ffffff";
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // water ripple lines
      for (let ri = 0; ri < 9; ri++) {
        const ry  = LY + H * 0.02 + ri * (SY - LY - H * 0.04) / 9;
        const amp = 2.5 + ri * 0.7;
        const dx  = Math.sin(ry * 0.038 + t * 0.95) * amp;
        const lw  = W * (0.06 + ri * 0.025);
        const lx  = W * 0.5 + dx - lw / 2;
        ctx.fillStyle = `rgba(255,255,255,${0.055 + ri * 0.005})`;
        ctx.fillRect(Math.max(0, lx), ry, Math.min(lw, W - Math.max(0, lx)), 1.5);
      }

      // ── Hippos (Lake Naivasha's iconic resident) ─────────────────────────
      const hpos: [number, number, number][] = [
        [W * 0.12, LY + H * 0.036, 0.55],
        [W * 0.22, LY + H * 0.028, 0.65],
        [W * 0.80, LY + H * 0.033, 0.58],
        [W * 0.90, LY + H * 0.040, 0.50],
      ];
      for (const [hx, hy, hs] of hpos) drawHippo(hx, hy, hs);

      // ── Shore / foreground ───────────────────────────────────────────────
      ctx.fillStyle = "#1c4a0c";
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, SY + H * 0.01);
      for (let i = 0; i <= 38; i++) {
        const x = (i / 38) * W;
        const n = Math.sin(x * 0.026 + 0.9) * 0.008 + Math.sin(x * 0.062) * 0.005;
        ctx.lineTo(x, SY + H * (0.01 - n));
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

      // ── Birds in sky ────────────────────────────────────────────────────
      for (const b of birds) {
        b.x     += b.vx;
        b.phase += 0.045;
        b.y     += b.vy + 0.018 * Math.sin(b.phase);
        if (b.x > W + 40) { b.x = -40; b.y = H * (0.06 + Math.random() * 0.22); }
        const flap = Math.sin(b.phase * 3.2) * 4.5;
        ctx.save();
        ctx.strokeStyle = "rgba(20,20,40,0.50)";
        ctx.lineWidth   = 1.3;
        ctx.lineCap     = "round";
        ctx.beginPath();
        ctx.moveTo(b.x - 8, b.y + flap);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(b.x + 8, b.y + flap);
        ctx.stroke();
        ctx.restore();
      }

      // ── Vignette (very subtle for light scene) ───────────────────────────
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.88);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,10,30,0.18)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }

    function loop(ts: number) {
      t     += Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      draw();
      animId  = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    lastTs = performance.now();
    animId = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", position: "absolute", inset: 0 }}
    />
  );
}
