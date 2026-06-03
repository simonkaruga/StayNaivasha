import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import PropertyCard, { PropertyCardData } from "../components/PropertyCard";
import SkeletonCard from "../components/SkeletonCard";

const TYPES = ["All", "cottage", "villa", "apartment", "conference", "campsite"];

async function fetchSearch(params: Record<string, string>): Promise<PropertyCardData[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/properties?${qs}`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function Search() {
  const [searchParams] = useSearchParams();
  const [type, setType] = useState("All");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const queryArgs: Record<string, string> = {};
  if (searchParams.get("location")) queryArgs.location = searchParams.get("location")!;
  if (searchParams.get("check_in")) queryArgs.check_in = searchParams.get("check_in")!;
  if (searchParams.get("check_out")) queryArgs.check_out = searchParams.get("check_out")!;
  if (type !== "All") queryArgs.property_type = type;
  if (minPrice) queryArgs.min_price = minPrice;
  if (maxPrice) queryArgs.max_price = maxPrice;

  const { data, isLoading } = useQuery({
    queryKey: ["properties", "search", queryArgs],
    queryFn: () => fetchSearch(queryArgs),
  });

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-20">
      {/* ── Filter bar ── */}
      <div className="sticky top-0 z-40 bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 py-3 space-y-3">
        {/* Type chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                type === t
                  ? "bg-[var(--color-forest)] text-white border-[var(--color-forest)]"
                  : "border-[var(--border)] text-[var(--text-muted)]"
              }`}
            >
              {t === "All" ? "All types" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Price range */}
        <div className="flex gap-2 items-center text-xs text-[var(--text-muted)]">
          <span>KES</span>
          <input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
            className="w-20 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-primary)] outline-none"
          />
          <span>–</span>
          <input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            className="w-20 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-primary)] outline-none"
          />
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Result count */}
        {!isLoading && data && (
          <p className="text-xs text-[var(--text-muted)] mb-3">
            {data.length} {data.length === 1 ? "home" : "homes"} found
          </p>
        )}

        {/* Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* No results */}
        {!isLoading && data?.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center space-y-3">
            <span className="text-5xl">🔍</span>
            <p className="font-medium text-[var(--text-primary)]">No homes match those filters</p>
            <p className="text-sm text-[var(--text-muted)]">Try wider dates or a different type</p>
            <button
              onClick={() => { setType("All"); setMinPrice(""); setMaxPrice(""); }}
              className="mt-2 text-[var(--color-teal)] text-sm font-medium underline"
            >
              Show all homes
            </button>
          </div>
        )}

        {/* Results */}
        {!isLoading && data && data.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {data.map(p => <PropertyCard key={p.id} p={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
