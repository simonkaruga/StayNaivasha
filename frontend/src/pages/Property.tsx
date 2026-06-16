import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wifi, Waves, Flame, UtensilsCrossed, Car, Sailboat, Bird,
  Monitor, Zap, Mountain, Droplets, Bell, Smartphone, Shield,
  Wind, Sparkles, Home as HomeIcon,
} from "lucide-react";
import { imgSrc } from "../utils/image";
import { useSEO } from "../utils/seo";
import { toggleSaved, isSaved } from "./Saved";
import { PropertyCardData } from "../components/PropertyCard";
import LeafletMap from "../components/LeafletMap";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Review {
  id: string;
  accuracy_score: number;
  cleanliness_score: number;
  location_score: number;
  value_score: number;
  avg_score: number;
  comment?: string;
  owner_response?: string;
  created_at: string;
}

interface PropertyDetail {
  id: string;
  title: string;
  type: string;
  price_per_night: number;
  description?: string;
  lat?: number;
  lng?: number;
  what3words?: string;
  landmark_instructions?: string;
  verified_tier: number;
  min_nights: number;
  max_guests?: number;
  host_name?: string;
  host_since?: string;
  host_id_verified?: boolean;
  response_time_hours?: number;
  images: { cloudinary_url: string; is_primary: boolean; display_order: number }[];
}

// ── Amenity inference ─────────────────────────────────────────────────────────

type Amenity = { keys: string[]; icon: React.ReactNode; label: string };

const AMENITY_MAP: Amenity[] = [
  { keys: ["wifi","wi-fi","internet","fibre"],            icon: <Wifi className="w-6 h-6 text-sky-500" />,          label: "WiFi" },
  { keys: ["pool","swim","swimming","infinity"],           icon: <Waves className="w-6 h-6 text-blue-500" />,        label: "Pool" },
  { keys: ["bbq","braai","grill","barbecue","bonfire","fire pit"], icon: <Flame className="w-6 h-6 text-orange-500" />, label: "BBQ" },
  { keys: ["kitchen","cooking","chef"],                   icon: <UtensilsCrossed className="w-6 h-6 text-amber-600" />, label: "Kitchen" },
  { keys: ["parking","garage"],                           icon: <Car className="w-6 h-6 text-slate-500" />,          label: "Parking" },
  { keys: ["lake","waterfront","water view","shore"],     icon: <Sailboat className="w-6 h-6 text-cyan-500" />,     label: "Lake view" },
  { keys: ["hippo","zebra","wildlife","bird","animal","fish eagle"],icon: <Bird className="w-6 h-6 text-pink-500" />,  label: "Wildlife" },
  { keys: ["projector","conference","whiteboard"],        icon: <Monitor className="w-6 h-6 text-slate-500" />,     label: "AV equipment" },
  { keys: ["zip","archery","cycling","team build"],       icon: <Zap className="w-6 h-6 text-yellow-500" />,        label: "Activities" },
  { keys: ["mountain","longonot","rift valley","volcano"],icon: <Mountain className="w-6 h-6 text-slate-600" />,   label: "Scenic view" },
  { keys: ["hot water","shower","bath","ensuite"],        icon: <Droplets className="w-6 h-6 text-sky-400" />,      label: "Hot water" },
  { keys: ["housekeeper","housekeeping","staff"],         icon: <Bell className="w-6 h-6 text-amber-500" />,        label: "Housekeeping" },
];

const TYPE_DEFAULTS: Record<string, { icon: React.ReactNode; label: string }[]> = {
  conference: [
    { icon: <Wifi className="w-6 h-6 text-sky-500" />,     label: "Fibre WiFi" },
    { icon: <Monitor className="w-6 h-6 text-slate-500" />, label: "Projector" },
    { icon: <Wind className="w-6 h-6 text-blue-400" />,    label: "AC" },
  ],
  campsite: [
    { icon: <Flame className="w-6 h-6 text-orange-500" />,   label: "Fire pit" },
    { icon: <Sparkles className="w-6 h-6 text-indigo-400" />, label: "Stargazing" },
    { icon: <Droplets className="w-6 h-6 text-sky-400" />,   label: "Ablutions" },
  ],
  villa: [
    { icon: <Waves className="w-6 h-6 text-blue-500" />,         label: "Pool" },
    { icon: <Bell className="w-6 h-6 text-amber-500" />,         label: "Staff" },
    { icon: <UtensilsCrossed className="w-6 h-6 text-amber-600" />, label: "Kitchen" },
  ],
};

function getAmenities(type: string, description = "") {
  const desc = description.toLowerCase();
  const found = AMENITY_MAP.filter(a => a.keys.some(k => desc.includes(k)));
  const defaults = TYPE_DEFAULTS[type] ?? [];
  const merged = [...found, ...defaults.filter(d => !found.some(f => f.label === d.label))];
  merged.push(
    { icon: <Smartphone className="w-6 h-6 text-green-600" />, label: "M-Pesa payment" },
    { icon: <Shield className="w-6 h-6 text-[var(--color-forest)]" />, label: "Escrow protected" },
  );
  return merged.slice(0, 10);
}

// ── Review bar component ──────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-[var(--text-muted)] w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-[var(--border)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--text-primary)] rounded-full transition-all duration-500"
          style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <span className="text-xs font-semibold text-[var(--text-primary)] w-6 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

// ── Availability calendar ─────────────────────────────────────────────────────

function AvailabilityCalendar({ propertyId, checkIn, checkOut, onCheckIn, onCheckOut, minNights }: {
  propertyId: string;
  checkIn: string; checkOut: string;
  onCheckIn: (d: string) => void; onCheckOut: (d: string) => void;
  minNights: number;
}) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { data: blocked = [] } = useQuery<{ date: string; is_blocked: boolean }[]>({
    queryKey: ["avail", propertyId, year, month],
    queryFn: async () => {
      const r = await fetch(`/api/properties/${propertyId}/availability?year=${year}&month=${month + 1}`);
      return r.ok ? r.json() : [];
    },
  });

  const blockedSet = new Set(blocked.filter(b => b.is_blocked).map(b => b.date));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const monthName   = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });

  function toISO(d: number) {
    return `${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }

  function handleDayTap(dateStr: string) {
    const dt = new Date(dateStr); dt.setHours(0,0,0,0);
    if (dt < today || blockedSet.has(dateStr)) return;
    if (!checkIn || (checkIn && checkOut)) {
      onCheckIn(dateStr); onCheckOut("");
    } else {
      const ci = new Date(checkIn);
      if (dt <= ci) { onCheckIn(dateStr); onCheckOut(""); return; }
      // Check no blocked dates in range
      let cur = new Date(ci); cur.setDate(cur.getDate() + 1);
      while (cur < dt) {
        const s = cur.toISOString().split("T")[0];
        if (blockedSet.has(s)) { onCheckIn(dateStr); onCheckOut(""); return; }
        cur.setDate(cur.getDate() + 1);
      }
      if ((dt.getTime() - ci.getTime()) / 86400000 < minNights) return;
      onCheckOut(dateStr);
    }
  }

  function dayClass(d: number): string {
    const s = toISO(d);
    const dt = new Date(s); dt.setHours(0,0,0,0);
    const isPast     = dt < today;
    const isBlocked  = blockedSet.has(s);
    const isCheckIn  = s === checkIn;
    const isCheckOut = s === checkOut;
    const ci = checkIn ? new Date(checkIn) : null;
    const co = checkOut ? new Date(checkOut) : null;
    const inRange = ci && co && dt > ci && dt < co;

    if (isCheckIn || isCheckOut) return "bg-[var(--color-forest)] text-white font-bold rounded-full";
    if (inRange)   return "bg-[var(--color-forest)]/15 text-[var(--color-forest)] font-medium";
    if (isPast || isBlocked) return "text-[var(--border)] line-through cursor-default";
    return "text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] rounded-full cursor-pointer";
  }

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  return (
    <>
      <Divider />
      <div className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-primary)]">Availability</h2>
          {minNights > 1 && <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-overlay)] px-2 py-0.5 rounded-full">{minNights}+ nights min</span>}
        </div>
        <div className="flex items-center justify-between mb-1">
          <button onClick={prevMonth} className="w-8 h-8 rounded-full bg-[var(--bg-overlay)] flex items-center justify-center text-[var(--text-muted)]">‹</button>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{monthName}</p>
          <button onClick={nextMonth} className="w-8 h-8 rounded-full bg-[var(--bg-overlay)] flex items-center justify-center text-[var(--text-muted)]">›</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
            <div key={d} className="text-[13px] font-semibold text-[var(--text-muted)] py-1">{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const s   = toISO(day);
            const dt  = new Date(s); dt.setHours(0,0,0,0);
            const canTap = dt >= today && !blockedSet.has(s);
            return (
              <button key={day} onClick={() => handleDayTap(s)} disabled={!canTap}
                className={`w-full aspect-square flex items-center justify-center text-xs transition-colors ${dayClass(day)}`}>
                {day}
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 text-[13px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[var(--color-forest)] inline-block" />Selected</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[var(--border)] inline-block" />Unavailable</span>
        </div>
      </div>
    </>
  );
}

// ── AI Chatbot ─────────────────────────────────────────────────────────────────

function ChatBot({ propertyId, propertyTitle }: { propertyId: string; propertyTitle: string }) {
  const [open,    setOpen]    = useState(false);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ role: "user"|"assistant"; content: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    const newHistory = [...history, { role: "user" as const, content: msg }];
    setHistory(newHistory);
    setLoading(true);
    try {
      const r = await fetch(`/api/properties/${propertyId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: history.slice(-6) }),
      });
      const data = r.ok ? await r.json() : { reply: "Sorry, I couldn't connect. Please try again." };
      setHistory([...newHistory, { role: "assistant", content: data.reply }]);
    } catch {
      setHistory([...newHistory, { role: "assistant", content: "Connection error — try again." }]);
    }
    setLoading(false);
  }, [input, loading, history, propertyId]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close chat" : "Ask about this property"}
        className="fixed bottom-36 right-4 z-50 w-14 h-14 rounded-full bg-[var(--color-forest)] text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform"
      >
        {open
          ? <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></svg>
          : <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        }
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 right-4 left-4 z-50 bg-[var(--bg-surface)] rounded-3xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col"
          style={{ maxHeight: "55vh", animation: "fade-up 0.2s ease-out both" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--color-forest)]">
            <div className="w-8 h-8 rounded-full bg-[var(--color-mint)] flex items-center justify-center text-[var(--color-forest)] text-sm font-bold">AI</div>
            <div>
              <p className="text-white text-sm font-semibold">Ask about this home</p>
              <p className="text-white/60 text-[13px]">{propertyTitle}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {history.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-[var(--text-muted)] text-center">Ask anything about this property</p>
                {["Is WiFi available?","How far from Nairobi?","Is the pool heated?"].map(q => (
                  <button key={q} onClick={() => { setInput(q); }}
                    className="w-full text-left text-xs bg-[var(--bg-overlay)] rounded-xl px-3 py-2 text-[var(--text-muted)]">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {history.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-[var(--color-forest)] text-white rounded-br-sm"
                    : "bg-[var(--bg-overlay)] text-[var(--text-primary)] rounded-bl-sm"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[var(--bg-overlay)] rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 px-3 py-3 border-t border-[var(--border)]">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask a question…"
              className="flex-1 bg-[var(--bg-overlay)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
            />
            <button onClick={send} disabled={!input.trim() || loading}
              className="w-10 h-10 bg-[var(--color-forest)] disabled:bg-[var(--border)] text-white rounded-xl flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Property() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();

  const [photoIndex,   setPhotoIndex]   = useState(0);
  const [galleryOpen,  setGalleryOpen]  = useState(false);
  const [checkIn,      setCheckIn]      = useState("");
  const [checkOut,     setCheckOut]     = useState("");
  const [guests,       setGuests]       = useState(1);
  const [saved,        setSaved]        = useState(() => isSaved(id ?? ""));
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [showAllRev,   setShowAllRev]   = useState(false);
  const [scrolled,     setScrolled]     = useState(false);
  const [showAllAmen,  setShowAllAmen]  = useState(false);
  const [copyToast,    setCopyToast]    = useState(false);
  const touchStartX    = useRef(0);
  const calendarRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 260);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const { data: prop, isLoading, isError } = useQuery<PropertyDetail>({
    queryKey: ["property", id],
    queryFn: async () => {
      const r = await fetch(`/api/properties/${id}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: !!id,
  });

  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const r = await fetch(`/api/reviews/property/${id}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!id,
  });

  // Similar stays from cache
  const allCached = queryClient.getQueryData<PropertyCardData[]>(["properties", "home"]) ?? [];
  const similar   = allCached.filter(p => p.id !== id).slice(0, 6);

  // SEO — must be called unconditionally before any early returns
  const primaryImg = prop?.images?.find(i => i.is_primary)?.cloudinary_url ?? prop?.images?.[0]?.cloudinary_url;
  useSEO({
    title: prop ? `${prop.title} — Naivasha` : "Property",
    description: prop?.description
      ? `${prop.description.slice(0, 140)}… Book via M-Pesa from KES ${prop.price_per_night.toLocaleString()}/night.`
      : prop
        ? `${prop.type.charAt(0).toUpperCase() + prop.type.slice(1)} in Naivasha from KES ${prop.price_per_night.toLocaleString()}/night.`
        : undefined,
    image: primaryImg,
    url: prop ? `/property/${prop.id}` : undefined,
    type: "article",
    jsonLd: prop ? {
      "@context": "https://schema.org",
      "@type": "LodgingBusiness",
      "name": prop.title,
      "description": prop.description ?? `${prop.type} in Naivasha, Kenya`,
      "image": prop.images.map(i => i.cloudinary_url),
      "url": `https://staynaivasha.co.ke/property/${prop.id}`,
      "priceRange": `KES ${prop.price_per_night.toLocaleString()}/night`,
      "currenciesAccepted": "KES",
      "paymentAccepted": "M-Pesa",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Naivasha",
        "addressRegion": "Nakuru County",
        "addressCountry": "KE",
      },
      ...(prop.lat && prop.lng ? {
        "geo": { "@type": "GeoCoordinates", "latitude": prop.lat, "longitude": prop.lng },
        "hasMap": `https://www.google.com/maps?q=${prop.lat},${prop.lng}`,
      } : {}),
      "amenityFeature": [],
      "starRating": prop.verified_tier >= 2 ? { "@type": "Rating", "ratingValue": "4" } : undefined,
    } : undefined,
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="h-72 bg-[var(--bg-surface)] animate-pulse" />
      <div className="p-4 space-y-3">
        {[80,60,40,100,60].map((w, i) => (
          <div key={i} className="h-4 bg-[var(--bg-surface)] rounded-full animate-pulse" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );

  if (isError || !prop) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 space-y-4">
      <span className="text-5xl">😕</span>
      <p className="font-semibold text-[var(--text-primary)]">This home isn't available</p>
      <button onClick={() => navigate(-1)} className="text-[var(--color-teal)] text-sm underline">Go back</button>
    </div>
  );

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
  }

  const imgs         = [...prop.images].sort((a, b) => a.display_order - b.display_order);
  const nights       = checkIn && checkOut ? Math.max(0, (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000) : 0;
  const base         = prop.price_per_night * nights;
  const levy         = Math.round(base * 0.02);
  const total        = base + levy + (nights > 0 ? 300 : 0);
  const mapsUrl      = prop.lat && prop.lng ? `https://www.google.com/maps/dir/?api=1&destination=${prop.lat},${prop.lng}&travelmode=driving` : null;
  const waUrl        = `https://wa.me/?text=${encodeURIComponent(`Check out this place in Naivasha:\nhttps://staynaivasha.co.ke/property/${prop.id}`)}`;
  const avgRating    = reviews.length ? reviews.reduce((s, r) => s + r.avg_score, 0) / reviews.length : null;
  const amenities    = getAmenities(prop.type, prop.description);
  const displayedRev = showAllRev ? reviews : reviews.slice(0, 3);

  const avgAccuracy    = reviews.length ? reviews.reduce((s, r) => s + r.accuracy_score,    0) / reviews.length : 0;
  const avgClean       = reviews.length ? reviews.reduce((s, r) => s + r.cleanliness_score, 0) / reviews.length : 0;
  const avgLocation    = reviews.length ? reviews.reduce((s, r) => s + r.location_score,    0) / reviews.length : 0;
  const avgValue       = reviews.length ? reviews.reduce((s, r) => s + r.value_score,       0) / reviews.length : 0;

  function share() {
    const url = `https://staynaivasha.co.ke/property/${prop!.id}`;
    if (navigator.share) {
      navigator.share({ title: prop!.title, text: `Check out this home in Naivasha`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 2500);
      }).catch(() => {});
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-56">

      {/* ── Sticky scroll header ── */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--bg-surface)] border-b border-[var(--border)] shadow-sm"
          : "bg-transparent pointer-events-none"
      }`}>
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => navigate(-1)}
            className={`w-9 h-9 rounded-full flex items-center justify-center pointer-events-auto transition-colors ${
              scrolled ? "bg-[var(--bg-primary)] text-[var(--text-primary)]" : "bg-black/40 text-white"
            }`}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          {scrolled && (
            <div className="flex-1 mx-3 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{prop.title}</p>
              <p className="text-xs text-[var(--color-teal)]">KES {prop.price_per_night.toLocaleString()}/night</p>
            </div>
          )}
          <div className="flex gap-2 pointer-events-auto">
            <button onClick={share} aria-label="Share"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                scrolled ? "bg-[var(--bg-primary)] text-[var(--text-primary)]" : "bg-black/40 text-white"
              }`}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
              </svg>
            </button>
            <button onClick={() => setSaved(toggleSaved(prop.id))} aria-label="Save"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                scrolled ? "bg-[var(--bg-primary)]" : "bg-black/40"
              }`}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill={saved ? "#ef4444" : "none"} stroke={saved ? "#ef4444" : scrolled ? "currentColor" : "white"} strokeWidth={2}>
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Photo hero ── */}
      <div className="relative bg-[var(--bg-surface)]"
        style={{ height: 300 }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const diff = e.changedTouches[0].clientX - touchStartX.current;
          if (diff < -50 && photoIndex < imgs.length - 1) setPhotoIndex(i => i + 1);
          if (diff > 50 && photoIndex > 0) setPhotoIndex(i => i - 1);
        }}
        onClick={() => imgs.length > 0 && setGalleryOpen(true)}>
        {imgs.length > 0
          ? <img src={imgSrc(imgs[photoIndex]?.cloudinary_url, 800)} alt={prop.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-teal)] flex items-center justify-center">
              <HomeIcon size={48} className="text-white/40" />
            </div>
        }
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/20" />

        {/* Photo counter */}
        {imgs.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            {photoIndex + 1} / {imgs.length}
          </div>
        )}

        {/* Dot indicators */}
        {imgs.length > 1 && imgs.length <= 8 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {imgs.map((_, i) => (
              <div key={i} className={`rounded-full transition-all ${i === photoIndex ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {imgs.length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none bg-[var(--bg-surface)] border-b border-[var(--border)]">
          {imgs.map((img, i) => (
            <button key={i} onClick={() => setPhotoIndex(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                i === photoIndex ? "border-[var(--color-forest)] opacity-100" : "border-transparent opacity-60"
              }`}>
              <img src={imgSrc(img.cloudinary_url, 120)} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <div className="px-4 pt-4">

        {/* ── Title block ── */}
        <div className="space-y-1 mb-3">
          <div className="flex items-start gap-2">
            <h1 className="font-display italic text-2xl text-[var(--text-primary)] leading-tight flex-1">
              {prop.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[var(--text-muted)] text-sm capitalize">{prop.type}</p>
            <span className="text-[var(--text-muted)] text-xs">·</span>
            <p className="text-[var(--text-muted)] text-sm">Naivasha, Kenya</p>
            {prop.verified_tier >= 2 && (
              <>
                <span className="text-[var(--text-muted)] text-xs">·</span>
                <span className="bg-[var(--color-forest)]/10 text-[var(--color-teal)] text-xs font-bold px-2 py-0.5 rounded-full">✓ Verified</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1 flex-wrap">
            {avgRating && (
              <span className="flex items-center gap-1 text-sm font-bold text-[var(--text-primary)]">
                <span className="text-amber-500">★</span> {avgRating.toFixed(2)}
                <span className="text-[var(--text-muted)] font-normal text-xs">({reviews.length} review{reviews.length !== 1 ? "s" : ""})</span>
              </span>
            )}
            {!avgRating && (
              <span className="text-xs bg-[var(--color-mint)]/15 text-[var(--color-teal)] font-semibold px-2 py-0.5 rounded-full">New listing</span>
            )}
            {prop.min_nights > 1 && (
              <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-0.5 rounded-full">
                {prop.min_nights}+ nights min
              </span>
            )}
            {prop.response_time_hours && (
              <span className="text-xs text-[var(--color-teal)] bg-[var(--color-teal)]/10 px-2 py-0.5 rounded-full font-medium">
                ⚡ Responds in {prop.response_time_hours}h
              </span>
            )}
          </div>
        </div>

        <Divider />

        {/* ── Highlights ── */}
        <div className="py-4 space-y-3.5">
          {[
            { icon: <HomeIcon className="w-6 h-6 text-[var(--color-teal)]" />, title: `Entire ${prop.type}`, sub: "Just for you · No shared spaces" },
            { icon: <Smartphone className="w-6 h-6 text-green-600" />,          title: "M-Pesa payment",     sub: "Instant STK Push · KES only" },
            { icon: <Shield className="w-6 h-6 text-[var(--color-forest)]" />,  title: "Escrow protected",   sub: "Funds released only at check-in" },
          ].map(h => (
            <div key={h.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex-shrink-0">{h.icon}</span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{h.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{h.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <Divider />

        {/* ── Host card ── */}
        <div className="flex items-center gap-3 py-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-teal)] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {(prop.host_name ?? "H")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--text-primary)] text-sm">
              {prop.host_name ?? "Local host"} · Naivasha
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="text-xs text-[var(--text-muted)]">
                Verified owner{prop.host_since ? ` · Since ${new Date(prop.host_since).getFullYear()}` : ""}
              </span>
              {prop.host_id_verified && (
                <span className="inline-flex items-center gap-0.5 text-[13px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M9 12l2 2 4-4" />
                    <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                  </svg>
                  ID Verified
                </span>
              )}
            </div>
          </div>
        </div>

        <Divider />

        {/* ── Description ── */}
        {prop.description && (
          <div className="py-4 space-y-2">
            <h2 className="font-semibold text-[var(--text-primary)]">About this place</h2>
            <p className={`text-[var(--text-muted)] text-sm leading-relaxed ${!showFullDesc && prop.description.length > 180 ? "line-clamp-4" : ""}`}>
              {prop.description}
            </p>
            {prop.description.length > 180 && (
              <button onClick={() => setShowFullDesc(!showFullDesc)}
                className="text-sm font-semibold text-[var(--text-primary)] underline underline-offset-2">
                {showFullDesc ? "Show less" : "Show more →"}
              </button>
            )}
          </div>
        )}

        <Divider />

        {/* ── Amenities ── */}
        <div className="py-4 space-y-3">
          <h2 className="font-semibold text-[var(--text-primary)]">What's included</h2>
          <div className="grid grid-cols-3 gap-2">
            {(showAllAmen ? amenities : amenities.slice(0, 6)).map(a => (
              <div key={a.label} className="flex flex-col items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-2 py-3 text-center">
                <span className="flex items-center justify-center">{a.icon}</span>
                <span className="text-[13px] font-medium text-[var(--text-primary)] leading-tight">{a.label}</span>
              </div>
            ))}
          </div>
          {amenities.length > 6 && (
            <button onClick={() => setShowAllAmen(s => !s)}
              className="w-full border border-[var(--border)] text-[var(--text-primary)] text-sm font-medium py-2.5 rounded-xl">
              {showAllAmen ? "Show fewer amenities" : `Show all ${amenities.length} amenities`}
            </button>
          )}
        </div>

        <Divider />

        {/* ── Location ── */}
        <div className="py-4 space-y-3">
          <h2 className="font-semibold text-[var(--text-primary)]">Location</h2>

          {/* Real interactive map */}
          <LeafletMap
            single
            height={200}
            pins={prop.lat && prop.lng ? [{
              id:    prop.id,
              lat:   prop.lat,
              lng:   prop.lng,
              label: prop.title,
              title: prop.title,
              href:  `/property/${prop.id}`,
            }] : []}
          />

          {prop.what3words && (
            <a href={`https://what3words.com/${prop.what3words}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[var(--bg-surface)] rounded-xl px-3 py-2.5">
              <span className="text-[var(--color-teal)] font-bold text-sm">///</span>
              <span className="text-sm text-[var(--color-teal)] font-medium underline underline-offset-2">{prop.what3words}</span>
            </a>
          )}

          {prop.landmark_instructions && (
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{prop.landmark_instructions}</p>
          )}

          {/* Drive time from Nairobi */}
          <div className="flex items-center gap-2 text-xs bg-[var(--bg-overlay)] rounded-xl px-3 py-2.5">
            <span>🚗</span>
            <span className="text-[var(--text-muted)]">
              <strong className="text-[var(--text-primary)]">~90 min</strong> from Nairobi via A104 highway
            </span>
          </div>

          <div className="flex gap-2">
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-forest)] text-white text-xs font-semibold py-3 rounded-xl">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                Navigate
              </a>
            )}
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white text-xs font-semibold py-3 rounded-xl">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.532 5.849L.073 23.927l6.244-1.635A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.645-.52-5.146-1.424l-.369-.219-3.826 1.003 1.02-3.722-.24-.382A9.944 9.944 0 012 12C2 6.478 6.477 2 12 2s10 4.478 10 10-4.477 10-10 10z" />
              </svg>
              Share
            </a>
          </div>
        </div>

        {/* ── Availability calendar ── */}
        <div ref={calendarRef}>
          <AvailabilityCalendar
            propertyId={prop.id}
            checkIn={checkIn}
            checkOut={checkOut}
            onCheckIn={setCheckIn}
            onCheckOut={setCheckOut}
            minNights={prop.min_nights}
          />
        </div>

        {/* ── Reviews ── */}
        {reviews.length > 0 && (
          <>
            <Divider />
            <div className="py-4 space-y-4">
              {/* Header with overall score */}
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-[var(--text-primary)]">
                  Reviews
                  <span className="text-[var(--text-muted)] font-normal text-sm ml-1.5">({reviews.length})</span>
                </h2>
                <div className="flex items-center gap-1.5 bg-[var(--color-forest)] text-white px-3 py-1.5 rounded-xl">
                  <span className="text-amber-300 text-sm">★</span>
                  <span className="font-bold text-sm">{avgRating!.toFixed(2)}</span>
                </div>
              </div>

              {/* Score breakdown bars */}
              <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2.5">
                <ScoreBar label="Accuracy"    value={avgAccuracy} />
                <ScoreBar label="Cleanliness" value={avgClean} />
                <ScoreBar label="Location"    value={avgLocation} />
                <ScoreBar label="Value"       value={avgValue} />
              </div>

              {/* Review cards */}
              <div className="space-y-3">
                {displayedRev.map((r, i) => {
                  const AVATARS = ["from-violet-500 to-purple-600","from-rose-400 to-pink-600","from-amber-400 to-orange-500","from-cyan-400 to-sky-600","from-emerald-400 to-teal-600","from-fuchsia-400 to-pink-500"];
                  const NAMES   = ["Amara W.","Brian K.","Cynthia M.","David O.","Esther N.","Felix R.","Grace A.","Hassan M.","Irene W.","James O."];
                  const avatarGrad = AVATARS[i % AVATARS.length];
                  const guestName  = NAMES[i % NAMES.length];
                  return (
                    <div key={r.id} className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2"
                      style={{ animation: `fade-up 0.3s ease-out ${i * 0.06}s both` }}>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                          {guestName[0]}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--text-primary)]">{guestName}</p>
                          <p className="text-[13px] text-[var(--text-muted)]">
                            {new Date(r.created_at).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}
                          </p>
                        </div>
                        <div className="ml-auto flex">
                          {[1,2,3,4,5].map(n => (
                            <span key={n} className={n <= Math.round(r.avg_score) ? "text-amber-400 text-xs" : "text-gray-300 text-xs"}>★</span>
                          ))}
                        </div>
                      </div>
                      {r.comment && <p className="text-sm text-[var(--text-primary)] leading-relaxed">{r.comment}</p>}
                      {r.owner_response && (
                        <div className="bg-[var(--bg-primary)] rounded-xl px-3 py-2 space-y-0.5">
                          <p className="text-[13px] font-semibold text-[var(--color-teal)]">Owner response</p>
                          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{r.owner_response}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {reviews.length > 3 && (
                <button onClick={() => setShowAllRev(!showAllRev)}
                  className="w-full border border-[var(--border)] text-[var(--text-primary)] text-sm font-medium py-3 rounded-xl">
                  {showAllRev ? "Show fewer reviews" : `Show all ${reviews.length} reviews`}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Similar stays ── */}
        {similar.length > 0 && (
          <>
            <Divider />
            <div className="py-4 space-y-3">
              <h2 className="font-semibold text-[var(--text-primary)]">More stays in Naivasha</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
                {similar.map(p => (
                  <Link key={p.id} to={`/property/${p.id}`}
                    className="flex-shrink-0 w-44 rounded-2xl overflow-hidden bg-[var(--bg-surface)] active:scale-95 transition-transform">
                    <div className="h-24 bg-[var(--bg-primary)] overflow-hidden">
                      {p.primary_image
                        ? <img src={imgSrc(p.primary_image, 180)} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                        : <div className="w-full h-full bg-[var(--color-forest)]" />
                      }
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-[var(--text-primary)] line-clamp-1">{p.title}</p>
                      <p className="text-xs text-[var(--color-teal)] font-semibold mt-0.5">
                        KES {p.price_per_night.toLocaleString()}<span className="text-[var(--text-muted)] font-normal">/night</span>
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Sticky booking widget ── */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-[var(--bg-surface)] border-t border-[var(--border)] px-4 pt-3 pb-3 shadow-2xl">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <span className="font-bold text-xl text-[var(--text-primary)]">KES {prop.price_per_night.toLocaleString()}</span>
            <span className="text-[var(--text-muted)] text-xs"> /night</span>
            {avgRating && (
              <span className="ml-2 text-xs text-[var(--text-muted)]">· <span className="text-amber-500">★</span> {avgRating.toFixed(1)}</span>
            )}
          </div>
          {nights > 0 && (
            <div className="text-right">
              <p className="text-[13px] text-[var(--text-muted)]">{nights} night{nights > 1 ? "s" : ""} · incl. fees</p>
              <p className="text-base font-bold text-[var(--text-primary)]">KES {total.toLocaleString()}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={() => calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className={`text-left bg-[var(--bg-primary)] border-2 rounded-xl px-3 py-2 transition-colors active:scale-[.98] ${checkIn ? "border-[var(--color-forest)]" : "border-[var(--border)]"}`}
          >
            <p className="text-[12px] text-[var(--text-muted)] font-bold uppercase tracking-wide">Check-in</p>
            <p className={`text-xs font-semibold mt-0.5 ${checkIn ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
              {checkIn ? fmtDate(checkIn) : "Add date"}
            </p>
          </button>
          <button
            onClick={() => calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className={`text-left bg-[var(--bg-primary)] border-2 rounded-xl px-3 py-2 transition-colors active:scale-[.98] ${checkOut ? "border-[var(--color-forest)]" : "border-[var(--border)]"}`}
          >
            <p className="text-[12px] text-[var(--text-muted)] font-bold uppercase tracking-wide">Check-out</p>
            <p className={`text-xs font-semibold mt-0.5 ${checkOut ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
              {checkOut ? fmtDate(checkOut) : "Add date"}
            </p>
          </button>
        </div>

        {/* Guests row */}
        <div className="flex items-center justify-between bg-[var(--bg-primary)] border-2 border-[var(--border)] rounded-xl px-3 py-2 mb-2">
          <p className="text-xs font-semibold text-[var(--text-muted)]">Guests</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setGuests(g => Math.max(1, g - 1))}
              className="w-6 h-6 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] font-bold text-sm">−</button>
            <span className="text-sm font-bold text-[var(--text-primary)] w-4 text-center">{guests}</span>
            <button type="button" onClick={() => setGuests(g => Math.min(prop.max_guests ?? 20, g + 1))}
              className="w-6 h-6 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] font-bold text-sm">+</button>
            {prop.max_guests && <span className="text-[13px] text-[var(--text-muted)]">max {prop.max_guests}</span>}
          </div>
        </div>

        <button
          onClick={() => navigate(`/booking/${prop.id}?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}`)}
          disabled={!checkIn || !checkOut || nights < prop.min_nights}
          className="w-full disabled:bg-[var(--bg-overlay)] disabled:text-[var(--text-muted)] text-white font-bold text-sm py-3.5 rounded-2xl transition-all active:scale-[.98]"
          style={(!checkIn || !checkOut || nights < prop.min_nights) ? {} : {
            background: "linear-gradient(135deg, #1e4a22 0%, #2a6838 100%)",
            boxShadow: "0 4px 14px rgba(13,61,32,0.4)",
          }}>
          {!checkIn || !checkOut
            ? "Select dates to reserve"
            : nights < prop.min_nights
            ? `Minimum ${prop.min_nights} nights`
            : `Reserve · KES ${total.toLocaleString()}`}
        </button>
      </div>

      {/* ── Copy toast ── */}
      {copyToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] bg-[var(--text-primary)] text-white text-sm font-medium px-4 py-2.5 rounded-2xl shadow-xl pointer-events-none"
          style={{ animation: "fade-up 0.2s ease-out both" }}>
          Link copied!
        </div>
      )}

      {/* ── AI Chatbot ── */}
      <ChatBot propertyId={prop.id} propertyTitle={prop.title} />

      {/* ── Full-screen gallery ── */}
      {galleryOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col"
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const diff = e.changedTouches[0].clientX - touchStartX.current;
            if (diff < -50 && photoIndex < imgs.length - 1) setPhotoIndex(i => i + 1);
            if (diff > 50 && photoIndex > 0) setPhotoIndex(i => i - 1);
          }}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setGalleryOpen(false)}
              className="w-9 h-9 bg-white/15 text-white rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <p className="text-white/70 text-sm">{photoIndex + 1} / {imgs.length}</p>
            <button onClick={share} className="w-9 h-9 bg-white/15 text-white rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
              </svg>
            </button>
          </div>
          {/* Main image */}
          <div className="flex-1 flex items-center justify-center px-4">
            <img src={imgSrc(imgs[photoIndex]?.cloudinary_url, 800)} alt="" className="max-h-full max-w-full object-contain rounded-xl" />
          </div>
          {/* Dot navigation */}
          <div className="flex justify-center gap-1.5 py-5">
            {imgs.map((_, i) => (
              <button key={i} onClick={() => setPhotoIndex(i)}
                className={`rounded-full transition-all ${i === photoIndex ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30"}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-[var(--border)]" />;
}
