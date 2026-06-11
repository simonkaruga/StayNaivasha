import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { imgSrc } from "../utils/image";
import { useSEO } from "../utils/seo";
import { toggleSaved, isSaved } from "./Saved";
import { PropertyCardData } from "../components/PropertyCard";
import TypeIcon from "../components/TypeIcon";
import LeafletMap, { MapPin } from "../components/LeafletMap";

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = "recommended" | "price_asc" | "price_desc" | "rating";

function SearchCard({ p }: { p: PropertyCardData }) {
  const [saved, setSaved] = useState(() => isSaved(p.id));
  const isGuestFavourite = (p.avg_rating ?? 0) >= 4.8 && (p.review_count ?? 0) >= 5;
  return (
    <Link to={`/property/${p.id}`}
      className="flex gap-0 bg-[var(--bg-surface)] rounded-2xl overflow-hidden active:scale-[.98] transition-transform card">
      {/* Photo */}
      <div className="relative w-32 flex-shrink-0" style={{ height: 112 }}>
        {p.primary_image
          ? <img src={imgSrc(p.primary_image, 260)} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-teal)] flex items-center justify-center">
              <TypeIcon type={p.type} className="w-8 h-8 text-white/30" />
            </div>
        }
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
        {isGuestFavourite && (
          <span className="absolute top-1.5 left-1.5 bg-white text-[var(--color-nearblack)] text-[7px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">❤️ Fave</span>
        )}
        {p.verified_tier >= 1 && (
          <span className="absolute top-1.5 right-1.5 bg-[var(--color-teal)] text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full">Trusted</span>
        )}
        {p.avg_rating && (
          <span className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <span className="text-amber-400">★</span>{p.avg_rating.toFixed(1)}
            {p.review_count ? <span className="text-white/60 font-normal text-[9px]">({p.review_count})</span> : null}
          </span>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 px-3 py-3 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 text-[9px] text-[var(--text-muted)] capitalize mb-0.5">
                <TypeIcon type={p.type} className="w-3 h-3" />{p.type}
              </span>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug line-clamp-2">{p.title}</h3>
            </div>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); setSaved(toggleSaved(p.id)); }}
              aria-label="Save" className="flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill={saved ? "#ef4444" : "none"} stroke={saved ? "#ef4444" : "var(--text-muted)"} strokeWidth={2}>
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            {!p.avg_rating && (
              <span className="text-[9px] bg-[var(--color-mint)]/15 text-[var(--color-teal)] font-semibold px-1.5 py-0.5 rounded-full">New</span>
            )}
            {p.review_count && p.review_count > 0 && (
              <span className="text-[9px] text-[var(--text-muted)]">{p.review_count} review{p.review_count !== 1 ? "s" : ""}</span>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-[var(--text-primary)]">KES {p.price_per_night.toLocaleString()}</p>
            <p className="text-[10px] text-[var(--text-muted)]">/night</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Filter bottom sheet ────────────────────────────────────────────────────────

function FilterSheet({
  minPrice, maxPrice, onMinPrice, onMaxPrice,
  types, onTypes, amenity, onAmenity, onClose,
}: {
  minPrice: string; maxPrice: string;
  onMinPrice: (v: string) => void; onMaxPrice: (v: string) => void;
  types: string[]; onTypes: (t: string[]) => void;
  amenity: string; onAmenity: (v: string) => void;
  onClose: () => void;
}) {
  const ALL_TYPES = ["cottage","villa","house","apartment","conference","campsite"];
  const AMENITY_CHIPS = ["Pool","WiFi","BBQ","Lake view","Kitchen","Parking","Wildlife","Conference"];

  function toggleType(t: string) {
    onTypes(types.includes(t) ? types.filter(x => x !== t) : [...types, t]);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-surface)] rounded-t-3xl px-5 pt-4 pb-8 space-y-5"
        style={{ animation: "fade-up 0.2s ease-out both" }}>
        {/* Handle */}
        <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto" />

        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-primary)]">Filters</h2>
          <button onClick={onClose} className="text-sm text-[var(--color-teal)] font-medium">Done</button>
        </div>

        {/* Keyword / amenity search */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">Search amenities</p>
          <input
            value={amenity}
            onChange={e => onAmenity(e.target.value)}
            placeholder="e.g. pool, wifi, conference, lake view…"
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--color-teal)]"
          />
          <div className="flex flex-wrap gap-1.5">
            {AMENITY_CHIPS.map(chip => (
              <button key={chip}
                onClick={() => onAmenity(amenity === chip.toLowerCase() ? "" : chip.toLowerCase())}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  amenity === chip.toLowerCase()
                    ? "bg-[var(--color-forest)] text-white border-[var(--color-forest)]"
                    : "border-[var(--border)] text-[var(--text-muted)]"
                }`}>
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Price range slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--text-primary)]">Price per night (KES)</p>
            <p className="text-xs font-semibold text-[var(--color-teal)]">
              {minPrice ? `${Number(minPrice).toLocaleString()}` : "0"} – {maxPrice ? `${Number(maxPrice).toLocaleString()}` : "100,000"}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Min</label>
              <input type="range" min={0} max={50000} step={500}
                value={minPrice || 0}
                onChange={e => onMinPrice(e.target.value === "0" ? "" : e.target.value)}
                className="w-full mt-2 accent-[var(--color-forest)]" />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">KES {Number(minPrice || 0).toLocaleString()}</p>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Max</label>
              <input type="range" min={0} max={100000} step={500}
                value={maxPrice || 100000}
                onChange={e => onMaxPrice(e.target.value === "100000" ? "" : e.target.value)}
                className="w-full mt-2 accent-[var(--color-forest)]" />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">KES {Number(maxPrice || 100000).toLocaleString()}</p>
            </div>
          </div>
          {/* Quick price presets */}
          <div className="flex gap-2 flex-wrap">
            {[["Budget",0,5000],["Mid",5000,15000],["Luxury",15000,0]].map(([label, min, max]) => (
              <button key={label as string}
                onClick={() => { onMinPrice(min ? String(min) : ""); onMaxPrice(max ? String(max) : ""); }}
                className="px-3 py-1 rounded-full text-[11px] font-medium border border-[var(--border)] text-[var(--text-muted)]">
                {label as string}
              </button>
            ))}
          </div>
        </div>

        {/* Property types */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">Property type</p>
          <div className="grid grid-cols-3 gap-2">
            {ALL_TYPES.map(t => (
              <button key={t} onClick={() => toggleType(t)}
                className={`py-2.5 rounded-xl text-xs font-medium border capitalize transition-colors ${
                  types.includes(t)
                    ? "bg-[var(--color-forest)] text-white border-[var(--color-forest)]"
                    : "border-[var(--border)] text-[var(--text-muted)]"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => { onMinPrice(""); onMaxPrice(""); onTypes([]); onAmenity(""); }}
          className="w-full border border-[var(--border)] text-[var(--text-muted)] text-sm py-3 rounded-xl">
          Clear all filters
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort,         setSort]         = useState<SortKey>("recommended");
  const [minPrice,     setMinPrice]     = useState("");
  const [maxPrice,     setMaxPrice]     = useState("");
  const [typeFilters,  setTypeFilters]  = useState<string[]>([]);
  const [amenityFilter, setAmenityFilter] = useState("");
  const [showFilters,  setShowFilters]  = useState(false);
  const [showSort,     setShowSort]     = useState(false);
  const [viewMode,     setViewMode]     = useState<"list"|"map">("list");

  const location = searchParams.get("location") ?? "";
  const checkIn  = searchParams.get("check_in") ?? "";
  const checkOut = searchParams.get("check_out") ?? "";
  const adults   = Number(searchParams.get("adults")   ?? searchParams.get("guests") ?? "1");
  const children = Number(searchParams.get("children") ?? "0");
  const rooms    = Number(searchParams.get("rooms")    ?? "1");
  const guests   = String(adults + children);
  const [guestsLocal, setGuestsLocal] = useState(guests);

  useSEO({
    title: location ? `Homes in Naivasha · "${location}"` : "Search Naivasha Homes",
    description: "Find and book verified vacation homes, cottages & conference retreats in Naivasha, Kenya.",
  });

  const { data: raw = [], isLoading, isError } = useQuery<PropertyCardData[]>({
    queryKey: ["properties", "search", checkIn, checkOut],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (checkIn)  p.set("check_in",  checkIn);
      if (checkOut) p.set("check_out", checkOut);
      const r = await fetch(`/api/properties/?${p.toString()}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    retry: 1,
  });

  const results = useMemo(() => {
    let list = [...raw];
    if (location) list = list.filter(p => p.title.toLowerCase().includes(location.toLowerCase()) || p.type.toLowerCase().includes(location.toLowerCase()));
    if (amenityFilter) {
      const kw = amenityFilter.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(kw) ||
        (p as any).description?.toLowerCase().includes(kw) ||
        p.type.toLowerCase().includes(kw)
      );
    }
    if (minPrice) list = list.filter(p => p.price_per_night >= Number(minPrice));
    if (maxPrice) list = list.filter(p => p.price_per_night <= Number(maxPrice));
    if (typeFilters.length) list = list.filter(p => typeFilters.includes(p.type));
    const g = Number(guestsLocal) || (adults + children);
    if (g > 1) list = list.filter(p => !p.max_guests || p.max_guests >= g);
    switch (sort) {
      case "price_asc":  return list.sort((a, b) => a.price_per_night - b.price_per_night);
      case "price_desc": return list.sort((a, b) => b.price_per_night - a.price_per_night);
      case "rating":     return list.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
      default:           return list;
    }
  }, [raw, location, minPrice, maxPrice, typeFilters, sort, guestsLocal, amenityFilter]);

  const activeFilterCount = (minPrice || maxPrice ? 1 : 0) + typeFilters.length + (amenityFilter ? 1 : 0);

  const SORT_LABELS: Record<SortKey, string> = {
    recommended: "Recommended",
    price_asc:   "Price: low to high",
    price_desc:  "Price: high to low",
    rating:      "Top rated",
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-14 pb-20">

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-[var(--bg-surface)] border-b border-[var(--border)]">
        {/* Search bar row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => window.history.back()}
            className="w-9 h-9 rounded-full bg-[var(--bg-primary)] flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <button className="flex-1 flex items-center gap-2 bg-[var(--bg-primary)] rounded-xl px-3 py-2.5"
            onClick={() => setSearchParams(p => p)}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <span className="text-sm text-[var(--text-primary)] font-medium truncate">
              {location || "Naivasha"}
            </span>
            {checkIn && checkOut && (
              <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{checkIn} – {checkOut}</span>
            )}
            {(adults > 1 || children > 0 || rooms > 1) && (
              <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                {adults}A · {children}C · {rooms}R
              </span>
            )}
          </button>

          {/* Guests stepper */}
          <div className="flex items-center gap-1.5 bg-[var(--bg-primary)] rounded-xl px-2.5 py-1.5 flex-shrink-0">
            <button type="button"
              onClick={() => { const v = String(Math.max(1, Number(guestsLocal) - 1)); setGuestsLocal(v); setSearchParams(p => { p.set("guests", v); return p; }); }}
              className="w-5 h-5 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] text-xs font-bold">−</button>
            <span className="text-xs font-semibold text-[var(--text-primary)] w-4 text-center">{guestsLocal}</span>
            <button type="button"
              onClick={() => { const v = String(Math.min(20, Number(guestsLocal) + 1)); setGuestsLocal(v); setSearchParams(p => { p.set("guests", v); return p; }); }}
              className="w-5 h-5 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] text-xs font-bold">+</button>
          </div>
        </div>

        {/* Filter + Sort row */}
        <div className="flex items-center gap-2 px-4 pb-2.5">
          {/* Filters button */}
          <button onClick={() => setShowFilters(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              activeFilterCount > 0
                ? "bg-[var(--color-forest)] text-white border-[var(--color-forest)]"
                : "border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-surface)]"
            }`}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 6h18M7 12h10M10 18h4" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-white text-[var(--color-forest)] w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort button */}
          <div className="relative">
            <button onClick={() => setShowSort(!showSort)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-surface)]">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 9l4-4 4 4M7 5v14M21 15l-4 4-4-4M17 19V5" />
              </svg>
              {SORT_LABELS[sort]}
            </button>
            {showSort && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSort(false)} />
                <div className="absolute left-0 top-full mt-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 w-52 py-1 overflow-hidden">
                  {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                    <button key={k} onClick={() => { setSort(k); setShowSort(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                        sort === k ? "bg-[var(--color-forest)] text-white" : "text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
                      }`}>
                      {SORT_LABELS[k]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* View toggle list/map */}
          <button onClick={() => setViewMode(v => v === "list" ? "map" : "list")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-surface)] ml-auto flex-shrink-0">
            {viewMode === "list"
              ? <><svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>Map</>
              : <><svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/></svg>List</>
            }
          </button>

          {/* Active filter tags */}
          {typeFilters.map(t => (
            <button key={t} onClick={() => setTypeFilters(f => f.filter(x => x !== t))}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold bg-[var(--color-forest)]/15 text-[var(--color-teal)] border border-[var(--color-teal)]/30">
              {t} ×
            </button>
          ))}

          {/* Weekend quick filter */}
          {(() => {
            const today = new Date();
            const day = today.getDay();
            const daysToFri = (5 - day + 7) % 7 || 7;
            const fri = new Date(today); fri.setDate(today.getDate() + daysToFri);
            const sun = new Date(fri); sun.setDate(fri.getDate() + 2);
            const friStr = fri.toISOString().split("T")[0];
            const sunStr = sun.toISOString().split("T")[0];
            const isActive = checkIn === friStr && checkOut === sunStr;
            return (
              <button
                onClick={() => setSearchParams(p => {
                  if (isActive) { p.delete("check_in"); p.delete("check_out"); }
                  else { p.set("check_in", friStr); p.set("check_out", sunStr); }
                  return p;
                })}
                className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold border transition-colors ${
                  isActive ? "bg-[var(--color-forest)] text-white border-[var(--color-forest)]" : "border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-surface)]"
                }`}>
                🏖 Weekend
              </button>
            );
          })()}
        </div>
      </div>

      {/* ── Results ── */}
      <div className="px-4 pt-4">
        {/* Result count + date context */}
        {!isLoading && !isError && (
          <div className="mb-3">
            <p className="text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-primary)]">{results.length}</span>{" "}
              {results.length === 1 ? "home" : "homes"} available
              {checkIn && checkOut ? (
                <span className="text-[var(--color-teal)] font-medium">
                  {" "}· {new Date(checkIn).toLocaleDateString("en-KE",{day:"numeric",month:"short"})} – {new Date(checkOut).toLocaleDateString("en-KE",{day:"numeric",month:"short"})}
                </span>
              ) : " in Naivasha"}
              {location ? ` · "${location}"` : ""}
            </p>
            {checkIn && checkOut && (
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                Homes with existing bookings on those dates are hidden
              </p>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex gap-3 bg-[var(--bg-surface)] rounded-2xl overflow-hidden h-24 animate-pulse">
                <div className="w-28 bg-[var(--bg-primary)]" />
                <div className="flex-1 py-3 pr-3 space-y-2">
                  <div className="h-3 bg-[var(--bg-primary)] rounded-full w-3/4" />
                  <div className="h-3 bg-[var(--bg-primary)] rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error / empty */}
        {viewMode === "list" && !isLoading && (isError || results.length === 0) && (
          <div className="flex flex-col items-center py-20 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-2xl">🔍</div>
            <p className="font-semibold text-[var(--text-primary)]">No homes found</p>
            <p className="text-sm text-[var(--text-muted)] max-w-[200px]">Try different dates or remove some filters.</p>
            <button onClick={() => { setMinPrice(""); setMaxPrice(""); setTypeFilters([]); }}
              className="text-[var(--color-teal)] text-sm font-medium underline">
              Clear filters
            </button>
          </div>
        )}

        {/* Map view */}
        {viewMode === "map" && !isLoading && (
          <>
            {(() => {
              const pins: MapPin[] = results
                .filter(p => p.lat && p.lng)
                .map(p => ({
                  id:    p.id,
                  lat:   p.lat!,
                  lng:   p.lng!,
                  label: `KES ${p.price_per_night.toLocaleString()}`,
                  title: p.title,
                  href:  `/property/${p.id}`,
                }));
              return <LeafletMap pins={pins} height={420} />;
            })()}
            <p className="text-[10px] text-[var(--text-muted)] text-center mt-2">Tap a price pin to view the listing</p>
          </>
        )}

        {/* Results list */}
        {viewMode === "list" && !isLoading && results.length > 0 && (
          <div className="space-y-3">
            {results.map((p, i) => (
              <div key={p.id} style={{ animation: `fade-up 0.25s ease-out ${i * 0.04}s both` }}>
                <SearchCard p={p} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter sheet */}
      {showFilters && (
        <FilterSheet
          minPrice={minPrice} maxPrice={maxPrice}
          onMinPrice={setMinPrice} onMaxPrice={setMaxPrice}
          types={typeFilters} onTypes={setTypeFilters}
          amenity={amenityFilter} onAmenity={setAmenityFilter}
          onClose={() => setShowFilters(false)}
        />
      )}
    </div>
  );
}
