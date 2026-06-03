import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PropertyCard, { PropertyCardData } from "../components/PropertyCard";
import SkeletonCard from "../components/SkeletonCard";

async function fetchProperties(search: string): Promise<PropertyCardData[]> {
  const url = search
    ? `/api/properties?${new URLSearchParams({ location: search })}`
    : "/api/properties";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function Home() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  const { data: properties, isLoading } = useQuery({
    queryKey: ["properties", "home"],
    queryFn: () => fetchProperties(""),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (input) params.set("location", input);
    if (checkIn) params.set("check_in", checkIn);
    if (checkOut) params.set("check_out", checkOut);
    navigate(`/search?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-20">
      {/* ── Hero ── */}
      <div className="relative h-[60vh] min-h-[360px] bg-[var(--color-nearblack)] flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        {/* Gradient overlay simulating lake atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1a10] via-[#0d3d20]/80 to-[#0a0f0a]" />

        <div className="relative z-10 space-y-4 max-w-lg">
          <p className="text-[var(--color-mint)] text-sm font-medium tracking-widest uppercase">Naivasha, Kenya</p>
          <h1 className="font-display italic text-4xl md:text-5xl text-white leading-tight">
            Wake up to the lake.
          </h1>
          <p className="text-gray-300 text-sm leading-relaxed">
            Verified vacation homes, cottages &amp; conference stays.<br />
            Book &amp; pay via M-Pesa in 30 seconds.
          </p>
        </div>

        {/* ── Search bar ── */}
        <form
          onSubmit={handleSearch}
          className="relative z-10 mt-8 w-full max-w-md bg-[var(--bg-surface)] rounded-2xl p-3 shadow-xl space-y-2"
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Where in Naivasha?"
            className="w-full bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm outline-none px-2 py-1"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={checkIn}
              onChange={e => setCheckIn(e.target.value)}
              className="flex-1 bg-[var(--bg-primary)] text-[var(--text-primary)] text-xs rounded-xl px-3 py-2 outline-none"
            />
            <input
              type="date"
              value={checkOut}
              onChange={e => setCheckOut(e.target.value)}
              className="flex-1 bg-[var(--bg-primary)] text-[var(--text-primary)] text-xs rounded-xl px-3 py-2 outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[var(--color-mint)] text-[var(--color-nearblack)] font-semibold text-sm py-3 rounded-xl active:scale-95 transition-transform"
          >
            Search homes
          </button>
        </form>
      </div>

      {/* ── Listings ── */}
      <div className="px-4 pt-6">
        <h2 className="text-[var(--text-primary)] font-semibold mb-4">Homes in Naivasha</h2>

        {isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!isLoading && properties?.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center space-y-3">
            <span className="text-5xl">🏡</span>
            <p className="font-medium text-[var(--text-primary)]">Be the first to list in Naivasha</p>
            <p className="text-sm text-[var(--text-muted)] max-w-xs">
              47 guests are waiting. List your home today — zero commission for 3 months.
            </p>
            <a
              href="/owner"
              className="mt-2 bg-[var(--color-forest)] text-white text-sm font-medium px-6 py-3 rounded-xl"
            >
              List your home
            </a>
          </div>
        )}

        {!isLoading && properties && properties.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {properties.map(p => <PropertyCard key={p.id} p={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
