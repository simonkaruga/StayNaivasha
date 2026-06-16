import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { toggleSaved, isSaved } from "../pages/Saved";
import { imgSrc } from "../utils/image";
import TypeIcon from "./TypeIcon";

export interface PropertyCardData {
  id: string;
  title: string;
  type: string;
  price_per_night: number;
  verified_tier: number;
  primary_image?: string;
  images?: string[];
  avg_rating?: number;
  review_count?: number;
  max_guests?: number;
  host_name?: string;
  host_since?: string;
  lat?: number;
  lng?: number;
}

// ── 3-D tilt (desktop only) ───────────────────────────────────────────────────
function useTilt() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(hover: none)").matches) return;
    const onMove  = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left)  / r.width  - 0.5;
      const y = (e.clientY - r.top)   / r.height - 0.5;
      el.style.transform  = `perspective(900px) rotateX(${(-y*8).toFixed(1)}deg) rotateY(${(x*8).toFixed(1)}deg) scale(1.02)`;
      el.style.transition = "transform 0.08s linear";
    };
    const onLeave = () => {
      el.style.transform  = "perspective(900px) rotateX(0) rotateY(0) scale(1)";
      el.style.transition = "transform 0.45s cubic-bezier(0.34,1.56,0.64,1)";
    };
    el.style.willChange = "transform";
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, []);
  return ref;
}

// ── Photo carousel ────────────────────────────────────────────────────────────
function PhotoCarousel({ photos, title }: { photos: string[]; title: string }) {
  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);
  const isDesktop = !window.matchMedia("(hover: none)").matches;

  const prev = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setIdx(i => (i - 1 + photos.length) % photos.length); };
  const next = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setIdx(i => (i + 1) % photos.length); };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) setIdx(i => dx < 0 ? (i + 1) % photos.length : (i - 1 + photos.length) % photos.length);
        touchX.current = null;
      }}
    >
      <img
        src={imgSrc(photos[idx], 420)}
        alt={title}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        loading="lazy"
        draggable={false}
      />

      {photos.length > 1 && (
        <>
          {/* Arrows — desktop only */}
          {isDesktop && (
            <>
              <button onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/85 backdrop-blur-sm rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="#333" strokeWidth={2.5}><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/85 backdrop-blur-sm rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="#333" strokeWidth={2.5}><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </>
          )}

          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
            {photos.map((_, i) => (
              <span key={i} className={`block rounded-full transition-all ${i === idx ? "w-3.5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/55"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
export default function PropertyCard({ p }: { p: PropertyCardData }) {
  const [saved, setSaved] = useState(() => isSaved(p.id));
  const tiltRef = useTilt();

  const photos = p.images?.length ? p.images : p.primary_image ? [p.primary_image] : [];
  const isGuestFavourite = (p.avg_rating ?? 0) >= 4.8 && (p.review_count ?? 0) >= 5;

  return (
    <Link
      ref={tiltRef}
      to={`/property/${p.id}`}
      style={{ transformStyle: "preserve-3d" }}
      className="group block rounded-2xl overflow-hidden bg-white shadow-sm active:scale-[.98]"
    >
      {/* ── Photo carousel ── */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
        {photos.length > 0
          ? <PhotoCarousel photos={photos} title={p.title} />
          : <div className="w-full h-full bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-mint)] flex items-center justify-center">
              <TypeIcon type={p.type} className="w-10 h-10 text-white/30" />
            </div>
        }

        {/* Guest Favourite badge */}
        {isGuestFavourite && (
          <span className="absolute top-2.5 left-2.5 bg-white text-[var(--color-nearblack)] text-[12px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
            ❤️ Guest Favourite
          </span>
        )}

        {/* Save heart */}
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); setSaved(toggleSaved(p.id)); }}
          aria-label={saved ? "Remove from saved" : "Save"}
          className="absolute top-2.5 right-2.5 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-90">
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]"
            fill={saved ? "#ef4444" : "none"}
            stroke={saved ? "#ef4444" : "#333333"}
            strokeWidth={2}>
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>
      </div>

      {/* ── Info below photo ── */}
      <div className="p-3 space-y-1.5">

        {/* Type · location · trust tags */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[13px] text-[var(--text-muted)] capitalize">
            <TypeIcon type={p.type} className="w-3 h-3" />
            {p.type} · Naivasha
          </span>
          <span className="flex items-center gap-1.5">
            {p.verified_tier === 1 && (
              <span className="flex items-center gap-0.5 text-[13px] font-semibold text-[var(--color-teal)]">
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 2l2.5 4.5L20 7.5l-4 4 1 5.5L12 14.5 7 17l1-5.5-4-4 5.5-1z"/>
                </svg>
                Trusted
              </span>
            )}
            {p.verified_tier >= 2 && (
              <span className="flex items-center gap-0.5 text-[13px] font-bold text-white px-1.5 py-0.5 rounded-full"
                style={{ background: "linear-gradient(135deg, #1e4a22, #186878)" }}>
                <BadgeCheck size={10} /> Team Verified
              </span>
            )}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[var(--text-primary)] text-sm leading-snug line-clamp-2">
          {p.title}
        </h3>

        {/* Rating + price */}
        <div className="flex items-center justify-between pt-0.5">
          <span>
            {p.avg_rating
              ? <span className="flex items-center gap-0.5">
                  <span className="text-amber-500 text-sm leading-none">★</span>
                  <span className="text-[13px] font-bold text-[var(--text-primary)]">{p.avg_rating.toFixed(1)}</span>
                  {p.review_count
                    ? <span className="text-[13px] text-[var(--text-muted)]">({p.review_count})</span>
                    : null}
                </span>
              : <span className="text-[13px] font-semibold text-[var(--color-mint)]">New</span>
            }
          </span>
          <p className="text-[13px] font-bold text-[var(--text-primary)]">
            KES {p.price_per_night.toLocaleString()}
            <span className="text-[13px] font-normal text-[var(--text-muted)]">/night</span>
          </p>
        </div>

      </div>
    </Link>
  );
}
