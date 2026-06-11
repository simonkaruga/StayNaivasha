import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid, Leaf, Gem, Home as HomeIcon, Building2, Briefcase, Tent,
  ShieldCheck, BadgeCheck, Navigation,
} from "lucide-react";
import PropertyCard, { PropertyCardData } from "../components/PropertyCard";
import SkeletonCard from "../components/SkeletonCard";
import CinematicHero from "../components/CinematicHero";
import RippleCursor from "../components/RippleCursor";
import TypeIcon from "../components/TypeIcon";
import { useMagnetic } from "../hooks/useMagnetic";
import { useCountUp } from "../hooks/useCountUp";
import { toggleSaved, isSaved } from "./Saved";
import { imgSrc } from "../utils/image";
import { useSEO } from "../utils/seo";

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchProperties(): Promise<PropertyCardData[]> {
  const res = await fetch("/api/properties/");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

// ── Category filters ──────────────────────────────────────────────────────────

const CATS = [
  { id: "",           label: "All",        icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { id: "cottage",    label: "Cottages",   icon: <Leaf className="w-3.5 h-3.5" /> },
  { id: "villa",      label: "Villas",     icon: <Gem className="w-3.5 h-3.5" /> },
  { id: "house",      label: "Houses",     icon: <HomeIcon className="w-3.5 h-3.5" /> },
  { id: "apartment",  label: "Apartments", icon: <Building2 className="w-3.5 h-3.5" /> },
  { id: "conference", label: "Retreats",   icon: <Briefcase className="w-3.5 h-3.5" /> },
  { id: "campsite",   label: "Camping",    icon: <Tent className="w-3.5 h-3.5" /> },
];

// ── Video hero background ─────────────────────────────────────────────────────
// Drop your video at frontend/public/hero.mp4 (and optionally hero.webm for
// smaller file sizes). Falls back to the canvas animation if video fails.
// Recommended: 15–30s loop, 1920×1080, < 8 MB compressed. Good free sources:
//   https://www.pexels.com/search/videos/lake%20naivasha/
//   https://coverr.co  (search "lake" or "safari")
//   https://www.videvo.net  (search "kenya" or "rift valley")

function VideoHero() {
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [videoReady,  setVideoReady]  = useState(false);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#1a0e04]">

      {/* Canvas runs while the photo is loading (instant, no blank flash) */}
      {!photoLoaded && <CinematicHero className="absolute inset-0" />}

      {/* Lake Naivasha photo — fades in once loaded */}
      <img
        src="/hero-bg.jpg"
        alt="Lake Naivasha at golden hour"
        onLoad={() => setPhotoLoaded(true)}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          objectPosition: "center 52%",
          opacity: photoLoaded ? 1 : 0,
          transition: "opacity 0.9s ease",
        }}
        fetchPriority="high"
        decoding="async"
      />

      {/* Optional video loop — overlays photo if hero.mp4 exists */}
      <video
        autoPlay muted loop playsInline preload="none"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: videoReady ? 1 : 0, transition: "opacity 1.2s ease", objectPosition: "center 52%" }}
        onCanPlay={() => setVideoReady(true)}
      >
        <source src="/hero.webm" type="video/webm" />
        <source src="/hero.mp4"  type="video/mp4" />
      </video>

      {/* Gradient — preserve the golden-hour glow in the middle,
          darken only the top (nav) and bottom (text) */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: [
          "linear-gradient(to bottom,",
          "  rgba(0,0,0,0.45) 0%,",
          "  rgba(0,0,0,0.08) 22%,",
          "  rgba(0,0,0,0.0)  42%,",
          "  rgba(0,0,0,0.0)  52%,",
          "  rgba(0,0,0,0.38) 68%,",
          "  rgba(0,0,0,0.82) 100%",
          ")",
        ].join(" "),
      }} />
    </div>
  );
}

// ── Featured card (first property — full width) ───────────────────────────────

function FeaturedCard({ p }: { p: PropertyCardData }) {
  const [saved, setSaved] = useState(() => isSaved(p.id));
  return (
    <Link to={`/property/${p.id}`} className="block rounded-3xl overflow-hidden relative card active:scale-[.98] transition-transform" style={{ height: 240 }}>
      {p.primary_image
        ? <img src={imgSrc(p.primary_image, 800)} alt={p.title} className="w-full h-full object-cover" loading="eager" />
        : <div className="w-full h-full bg-[var(--color-forest)]" />
      }
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      {/* top row */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
        <span className="bg-black/50 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
          <TypeIcon type={p.type} className="w-3 h-3" />
          <span className="capitalize">{p.type}</span>
        </span>
        <div className="flex items-center gap-2">
          {p.verified_tier >= 2 && (
            <span className="bg-[var(--color-forest)] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">✓ Verified</span>
          )}
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setSaved(toggleSaved(p.id)); }}
            aria-label={saved ? "Remove from saved" : "Save"}
            className="w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill={saved ? "#ef4444" : "none"} stroke={saved ? "#ef4444" : "white"} strokeWidth={2}>
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        </div>
      </div>

      {/* bottom text */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="font-display italic text-2xl text-white leading-tight mb-1">{p.title}</h3>
        <div className="flex items-center justify-between">
          <p className="text-[var(--color-mint)] font-bold text-sm">
            KES {p.price_per_night.toLocaleString()}
            <span className="text-white/50 font-normal text-xs"> /night</span>
          </p>
          {p.avg_rating
            ? <span className="bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="text-amber-400">★</span> {p.avg_rating.toFixed(1)}
                {p.review_count ? <span className="text-white/60 font-normal">({p.review_count})</span> : null}
              </span>
            : <span className="text-[9px] bg-[var(--color-mint)]/20 text-[var(--color-mint)] font-semibold px-2 py-0.5 rounded-full">New listing</span>
          }
        </div>
      </div>
    </Link>
  );
}

// ── Animated stat counters ────────────────────────────────────────────────────

function Stat({ value, suffix, label, decimals = 0 }: { value: number; suffix: string; label: string; decimals?: number }) {
  const { count, ref } = useCountUp(value, 1800);
  const display = decimals > 0 ? (count / Math.pow(10, decimals)).toFixed(decimals) : count.toLocaleString();
  return (
    <div ref={ref} className="text-center py-4">
      <p className="text-2xl font-bold text-[var(--text-primary)] leading-none">
        {display}<span className="text-[var(--color-teal)] text-lg">{suffix}</span>
      </p>
      <p className="text-[10px] text-[var(--text-muted)] mt-1">{label}</p>
    </div>
  );
}

function StatBar() {
  const { data } = useQuery<{ property_count: number; avg_rating: number; booking_count: number }>({
    queryKey: ["stats"],
    queryFn: async () => {
      const r = await fetch("/api/properties/stats");
      return r.ok ? r.json() : { property_count: 0, avg_rating: 0, booking_count: 0 };
    },
    staleTime: 5 * 60 * 1000,
  });
  return (
    <div className="mt-8 grid grid-cols-3 divide-x divide-[var(--border)] bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
      <Stat value={data?.booking_count ?? 0}         suffix="+" label="Verified stays" />
      <Stat value={Math.round((data?.avg_rating ?? 0) * 10)} suffix="★" label="Avg rating" decimals={1} />
      <Stat value={data?.property_count ?? 0}        suffix="+" label="Homes listed" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const [location, setLocation] = useState("");
  const [checkIn,  setCheckIn]  = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults,   setAdults]   = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms,    setRooms]    = useState(1);
  const [showGuests, setShowGuests] = useState(false);
  const [cat, setCat]           = useState("");

  const { data: all, isLoading, isError } = useQuery({
    queryKey: ["properties", "home"],
    queryFn: fetchProperties,
    retry: 1,
  });

  const properties = useMemo(
    () => cat ? all?.filter(p => p.type === cat) : all,
    [all, cat]
  );

  useSEO({
    title: "Naivasha Vacation Rentals",
    description: "Verified cottages, villas & retreats in Naivasha, Kenya. Book via M-Pesa in 30 seconds. ~90 min from Nairobi via A104.",
  });

  const guestSummary = `${adults} adult${adults !== 1 ? "s" : ""} · ${children} child${children !== 1 ? "ren" : ""} · ${rooms} room${rooms !== 1 ? "s" : ""}`;

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (location) p.set("location", location);
    if (checkIn)  p.set("check_in",  checkIn);
    if (checkOut) p.set("check_out", checkOut);
    p.set("adults",   String(adults));
    p.set("children", String(children));
    p.set("rooms",    String(rooms));
    p.set("guests",   String(adults + children));
    navigate(`/search?${p.toString()}`);
  }, [location, checkIn, checkOut, adults, children, rooms, navigate]);

  const ownerCtaRef = useMagnetic<HTMLAnchorElement>(0.25);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-14 pb-20">

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <div className="relative flex flex-col overflow-hidden" style={{ minHeight: "100svh" }}>

        {/* ── Video background (drop hero.mp4 into frontend/public/) ── */}
        <VideoHero />

        {/* ── Water ripple cursor (desktop only) ── */}
        <RippleCursor />

        {/* ── Content — anchored bottom-left, landscape breathes above ── */}
        <div className="relative z-10 flex-1 flex flex-col justify-end px-5 pb-10"
          style={{ animation: "fade-up 0.8s ease-out both" }}>

          {/* Location — whisper-small */}
          <p className="text-white/45 text-[10px] font-medium tracking-[0.55em] uppercase mb-4"
            style={{ animation: "fade-up 0.8s ease-out 0.06s both" }}>
            Naivasha · Kenya
          </p>

          {/* Headline — let it breathe */}
          <h1
            className="font-display italic text-white"
            style={{
              fontSize: "clamp(3.8rem, 15vw, 6.5rem)",
              lineHeight: 0.88,
              animation: "fade-up 0.8s ease-out 0.14s both",
            }}>
            Wake up<br />to the lake.
          </h1>

          {/* Search card — floats over hero with glass effect */}
          <form onSubmit={handleSearch} className="mt-6"
            style={{ animation: "fade-up 0.8s ease-out 0.24s both" }}>
            <div className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.25)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              }}>

              {/* Where are you going? */}
              <div className="px-4 pt-4 pb-3 border-b border-white/15">
                <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">Where are you going?</p>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Search hotels, homes, and much more…"
                  className="w-full text-[15px] font-semibold text-white outline-none bg-transparent placeholder:text-white/35"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 divide-x divide-white/15 border-b border-white/15">
                <div className="px-4 pt-3 pb-2.5">
                  <p className="text-[9px] text-white/50 tracking-[0.18em] uppercase font-semibold mb-1">Check-in</p>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={e => setCheckIn(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full text-[13px] font-semibold text-white outline-none bg-transparent [color-scheme:dark]"
                  />
                  {!checkIn && <p className="text-[13px] font-semibold text-white/30 -mt-[18px] pointer-events-none">—</p>}
                </div>
                <div className="px-4 pt-3 pb-2.5">
                  <p className="text-[9px] text-white/50 tracking-[0.18em] uppercase font-semibold mb-1">Check-out</p>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={e => setCheckOut(e.target.value)}
                    min={checkIn || new Date().toISOString().split("T")[0]}
                    className="w-full text-[13px] font-semibold text-white outline-none bg-transparent [color-scheme:dark]"
                  />
                  {!checkOut && <p className="text-[13px] font-semibold text-white/30 -mt-[18px] pointer-events-none">—</p>}
                </div>
              </div>

              {/* Guests trigger */}
              <button
                type="button"
                onClick={() => setShowGuests(v => !v)}
                className="w-full px-4 py-2.5 border-b border-white/15 text-left">
                <p className="text-[9px] text-white/50 tracking-[0.18em] uppercase font-semibold mb-1">Who's coming?</p>
                <p className="text-[13px] font-semibold text-white">{guestSummary}</p>
              </button>

              {/* Guests expanded */}
              {showGuests && (
                <div className="px-4 py-3 border-b border-white/15 space-y-3">
                  {([
                    { label: "Adults",   sub: "Age 13+",   val: adults,   min: 1, set: setAdults },
                    { label: "Children", sub: "Ages 0–12", val: children, min: 0, set: setChildren },
                    { label: "Rooms",    sub: "",           val: rooms,    min: 1, set: setRooms },
                  ] as const).map(({ label, sub, val, min, set }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-semibold text-white">{label}</p>
                        {sub && <p className="text-[11px] text-white/50">{sub}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <button type="button"
                          onClick={() => set((v: number) => Math.max(min, v - 1))}
                          className="w-7 h-7 rounded-full border border-white/30 flex items-center justify-center text-white font-bold text-base leading-none">−</button>
                        <span className="text-[13px] font-semibold text-white w-4 text-center">{val}</span>
                        <button type="button"
                          onClick={() => set((v: number) => Math.min(20, v + 1))}
                          className="w-7 h-7 rounded-full border border-white/30 flex items-center justify-center text-white font-bold text-base leading-none">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <div className="px-3 pb-3 pt-2.5">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl text-white font-bold text-sm tracking-wide active:scale-[.98] transition-transform"
                  style={{
                    background: "linear-gradient(135deg, #b8722a 0%, #d4892a 60%, #e8a030 100%)",
                    boxShadow: "0 4px 20px rgba(212,137,42,0.55)",
                  }}>
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Scroll cue — just the arrow, no text */}
        <div className="relative z-10 flex justify-center pb-3">
          <svg viewBox="0 0 16 24" className="w-3 opacity-30"
            fill="none" stroke="white" strokeWidth={1.5}
            style={{ animation: "scroll-cue 2s ease-in-out infinite" }}>
            <path d="M8 4 L8 16 M4 12 L8 16 L12 12" />
          </svg>
        </div>
      </div>

      {/* ════════════════════════════════════════
          CATEGORY FILTER BAR
      ════════════════════════════════════════ */}
      <div className="sticky top-0 z-40 bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border)]">
        <div className="flex gap-2 overflow-x-auto px-4 py-2.5 scrollbar-none">
          {CATS.map(c => {
            const count = c.id ? all?.filter(p => p.type === c.id).length : all?.length;
            return (
              <button key={c.id} onClick={() => setCat(c.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  cat === c.id
                    ? "bg-[var(--color-forest)] text-white border-[var(--color-forest)] shadow-sm"
                    : "border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-surface)]"
                }`}>
                <span className="text-sm leading-none">{c.icon}</span>
                {c.label}
                {count != null && count > 0 && (
                  <span className={`text-[9px] font-bold px-1 py-0 rounded-full ${
                    cat === c.id ? "bg-white/20 text-white" : "bg-[var(--bg-overlay)] text-[var(--text-muted)]"
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════
          LISTINGS
      ════════════════════════════════════════ */}
      <div className="px-4 pt-5">

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            <div className="h-52 rounded-3xl bg-[var(--bg-surface)] animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
            </div>
          </div>
        )}

        {/* Empty / error */}
        {!isLoading && (isError || !properties?.length) && (
          <div className="flex flex-col items-center py-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-3xl">🏡</div>
            <p className="font-semibold text-[var(--text-primary)]">
              {cat ? `No ${cat}s listed yet` : "Be the first to list"}
            </p>
            <p className="text-sm text-[var(--text-muted)] max-w-[220px]">
              {cat
                ? "Try a different type or browse all homes."
                : "47 guests are waiting. Zero commission for 3 months."}
            </p>
            {cat
              ? <button onClick={() => setCat("")} className="text-[var(--color-teal)] text-sm font-medium underline">Show all homes</button>
              : <Link to="/list-your-property" className="mt-1 bg-[var(--color-forest)] text-white text-sm font-semibold px-6 py-3 rounded-xl">List your home</Link>
            }
          </div>
        )}

        {/* Results */}
        {!isLoading && properties && properties.length > 0 && (
          <div className="space-y-3">
            {/* Section label */}
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--text-primary)] text-base">
                {cat
                  ? `${cat.charAt(0).toUpperCase() + cat.slice(1)}s · Naivasha`
                  : "Homes in Naivasha"}
              </h2>
              <span className="text-xs text-[var(--text-muted)]">{properties.length} homes</span>
            </div>

            {/* Featured first */}
            <FeaturedCard p={properties[0]} />

            {/* 2-column grid for the rest */}
            {properties.length > 1 && (
              <div className="grid grid-cols-2 gap-3">
                {properties.slice(1).map(p => <PropertyCard key={p.id} p={p} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Stat counters ── */}
        <StatBar />

        {/* ── Trust strip ── */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: <ShieldCheck className="w-5 h-5 text-[var(--color-forest)]" />, title: "M-Pesa Escrow",   sub: "Money held until check-in" },
            { icon: <BadgeCheck  className="w-5 h-5 text-blue-600" />,               title: "Verified Homes", sub: "Every photo approved" },
            { icon: <Navigation  className="w-5 h-5 text-[var(--color-teal)]" />,    title: "Directions",     sub: "GPS + landmark guide" },
          ].map(({ icon, title, sub }) => (
            <div key={title} className="bg-[var(--bg-surface)] rounded-2xl p-3 space-y-1 border border-[var(--border)]">
              <span className="flex justify-center">{icon}</span>
              <p className="text-[10px] font-bold text-[var(--text-primary)] leading-tight">{title}</p>
              <p className="text-[9px] text-[var(--text-muted)] leading-tight">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Owner CTA ── */}
        <div className="mt-4 mb-6 rounded-3xl overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, #1e4a22 0%, #2a6030 40%, #4a2c10 80%, #3a200a 100%)" }}>
          <div className="px-5 py-6">
            <p className="text-[var(--color-mint)] text-[10px] font-semibold tracking-[0.25em] uppercase mb-2">
              For property owners
            </p>
            <h3 className="font-display italic text-white text-2xl leading-tight mb-2">
              Earn via M-Pesa.<br />Zero commission<br />for 3 months.
            </h3>
            <p className="text-white/55 text-xs mb-4 max-w-[200px]">
              List your Naivasha home. Payouts within 2 hours of check-in.
            </p>
            <Link ref={ownerCtaRef} to="/list-your-property"
              className="inline-flex items-center gap-2 bg-[var(--color-mint)] text-[var(--color-nearblack)] font-bold text-sm px-5 py-2.5 rounded-xl">
              List your home
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          {/* decorative circle */}
          <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full"
            style={{ background: "rgba(62,200,144,0.08)" }} />
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full"
            style={{ background: "rgba(62,200,144,0.05)" }} />
        </div>

        {/* ── Curated collections ── */}
        {all && all.length > 0 && (() => {
          const COLLECTIONS = [
            { label: "Best for families",   emoji: "👨‍👩‍👧", filter: (p: PropertyCardData) => (p.max_guests ?? 0) >= 6 || ["house","villa","cottage"].includes(p.type) },
            { label: "Conference retreats", emoji: "🏛️",        filter: (p: PropertyCardData) => p.type === "conference" },
            { label: "Under KES 5,000",     emoji: "💰",        filter: (p: PropertyCardData) => p.price_per_night < 5000 },
            { label: "Top rated",           emoji: "⭐",        filter: (p: PropertyCardData) => (p.avg_rating ?? 0) >= 4.5 },
            { label: "Camping & outdoors",  emoji: "⛺",        filter: (p: PropertyCardData) => p.type === "campsite" },
            { label: "Lake view villas",    emoji: "🌊",        filter: (p: PropertyCardData) => p.type === "villa" },
          ].filter(c => all.some(c.filter));
          if (!COLLECTIONS.length) return null;
          return (
            <div className="mt-6 mb-2 space-y-3">
              <h2 className="font-semibold text-[var(--text-primary)] text-base">Browse by vibe</h2>
              <div className="grid grid-cols-2 gap-2">
                {COLLECTIONS.map(c => {
                  const count = all.filter(c.filter).length;
                  return (
                    <button key={c.label}
                      onClick={() => navigate(`/search?location=${encodeURIComponent(c.label)}`)}
                      className="flex items-center gap-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-3 py-3 text-left active:scale-[.97] transition-transform">
                      <span className="text-2xl leading-none flex-shrink-0">{c.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-primary)] leading-snug">{c.label}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{count} home{count !== 1 ? "s" : ""}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Footer links ── */}
        <div className="mt-6 mb-4 pt-4 border-t border-[var(--border)]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-4">
            {([
              { to: "/how-it-works",        label: "How it works" },
              { to: "/about",               label: "About StayNaivasha" },
              { to: "/terms",               label: "Terms of service" },
              { to: "/privacy",             label: "Privacy policy" },
              { to: "/cancellation-policy", label: "Cancellation policy" },
              { to: "/list-your-property", label: "List your property" },
            ] as const).map(l => (
              <Link key={l.to} to={l.to} className="text-xs text-[var(--text-muted)] underline underline-offset-2">{l.label}</Link>
            ))}
          </div>
          <p className="text-[10px] text-[var(--text-muted)] text-center">
            © {new Date().getFullYear()} StayNaivasha · Naivasha, Kenya
          </p>
        </div>
      </div>
    </div>
  );
}
