import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import SkeletonCard from "../components/SkeletonCard";

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
  response_time_hours?: number;
  images: { cloudinary_url: string; is_primary: boolean; display_order: number }[];
}

async function fetchProperty(id: string): Promise<PropertyDetail> {
  const res = await fetch(`/api/properties/${id}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

export default function Property() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  const { data: prop, isLoading, isError } = useQuery({
    queryKey: ["property", id],
    queryFn: () => fetchProperty(id!),
    enabled: !!id,
  });

  if (isLoading) return (
    <div className="p-4 space-y-3 pb-32">
      <div className="h-56 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
      <SkeletonCard />
    </div>
  );

  if (isError || !prop) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 space-y-3">
      <span className="text-5xl">😕</span>
      <p className="font-medium text-[var(--text-primary)]">This home isn't available</p>
      <button onClick={() => navigate(-1)} className="text-[var(--color-teal)] underline text-sm">Go back</button>
    </div>
  );

  const sortedImages = [...prop.images].sort((a, b) => a.display_order - b.display_order);
  const nights = checkIn && checkOut
    ? Math.max(0, (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    : 0;
  const total = nights > 0 ? (prop.price_per_night * nights + 300 + Math.round(prop.price_per_night * nights * 0.02)) : 0;

  const mapsUrl = prop.lat && prop.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${prop.lat},${prop.lng}&travelmode=driving`
    : null;
  const waShareUrl = `https://wa.me/?text=${encodeURIComponent(`Check out this place in Naivasha: https://staynaivasha.co.ke/property/${prop!.id}`)}`;

  function handleBook() {
    if (!checkIn || !checkOut) return;
    navigate(`/booking/${prop!.id}?check_in=${checkIn}&check_out=${checkOut}`);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-44">
      {/* ── Photo strip ── */}
      <div className="relative">
        {sortedImages.length > 0 ? (
          <div
            className="h-64 overflow-hidden cursor-pointer"
            onClick={() => setGalleryOpen(true)}
          >
            <img
              src={sortedImages[photoIndex]?.cloudinary_url}
              alt={prop.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
              {photoIndex + 1} / {sortedImages.length}
            </div>
            {/* Thumbnail strip */}
            <div className="absolute bottom-3 left-3 flex gap-1">
              {sortedImages.slice(0, 5).map((img, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setPhotoIndex(i); }}
                  className={`w-8 h-8 rounded-md overflow-hidden border-2 ${i === photoIndex ? "border-white" : "border-transparent"}`}
                >
                  <img src={img.cloudinary_url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-64 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[var(--text-muted)]">
            No photos yet
          </div>
        )}

        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 bg-black/50 text-white rounded-full flex items-center justify-center text-lg"
          aria-label="Go back"
        >
          ‹
        </button>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-4 space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="font-display text-2xl text-[var(--text-primary)] leading-snug">{prop.title}</h1>
            {prop.verified_tier >= 2 && (
              <span className="flex-shrink-0 bg-[var(--color-forest)] text-white text-xs px-2 py-0.5 rounded-full">
                ✓ Verified
              </span>
            )}
          </div>
          <p className="text-[var(--text-muted)] text-sm capitalize mt-1">{prop.type} · Naivasha</p>
          {prop.response_time_hours && (
            <p className="text-xs text-[var(--color-teal)] mt-1">Responds within {prop.response_time_hours}h</p>
          )}
        </div>

        {/* Description */}
        {prop.description && (
          <p className="text-[var(--text-muted)] text-sm leading-relaxed">{prop.description}</p>
        )}

        {/* Location */}
        {(mapsUrl || prop.what3words || prop.landmark_instructions) && (
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2">
            <p className="font-medium text-[var(--text-primary)] text-sm">Getting there</p>
            {prop.what3words && (
              <p className="text-xs text-[var(--text-muted)]">
                <span className="font-medium text-[var(--color-teal)]">///</span> {prop.what3words}
              </p>
            )}
            {prop.landmark_instructions && (
              <p className="text-xs text-[var(--text-muted)]">{prop.landmark_instructions}</p>
            )}
            <div className="flex gap-2 pt-1">
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-[var(--color-forest)] text-white text-xs font-medium py-2.5 rounded-xl text-center"
                >
                  Open in Google Maps
                </a>
              )}
              <a
                href={waShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-[#25D366] text-white text-xs font-medium py-2.5 rounded-xl text-center"
              >
                Share on WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky booking widget ── */}
      <div className="fixed bottom-16 left-0 right-0 bg-[var(--bg-surface)] border-t border-[var(--border)] px-4 py-3 z-40">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-[var(--text-primary)]">
            KES {prop.price_per_night.toLocaleString()}
            <span className="font-normal text-[var(--text-muted)] text-xs"> /night</span>
          </p>
          {nights > 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              {nights} night{nights > 1 ? "s" : ""} · KES {total.toLocaleString()} total
            </p>
          )}
        </div>
        <div className="flex gap-2 mb-2">
          <input
            type="date"
            value={checkIn}
            onChange={e => setCheckIn(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl px-3 py-2 outline-none"
          />
          <input
            type="date"
            value={checkOut}
            onChange={e => setCheckOut(e.target.value)}
            min={checkIn || new Date().toISOString().split("T")[0]}
            className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl px-3 py-2 outline-none"
          />
        </div>
        <button
          onClick={handleBook}
          disabled={!checkIn || !checkOut || nights < prop.min_nights}
          className="w-full bg-[var(--color-mint)] disabled:bg-gray-300 text-[var(--color-nearblack)] font-semibold text-sm py-3 rounded-xl transition-colors"
        >
          {!checkIn || !checkOut
            ? "Select dates"
            : nights < prop.min_nights
            ? `Min ${prop.min_nights} nights`
            : "Book Now"}
        </button>
      </div>

      {/* ── Full-screen gallery overlay ── */}
      {galleryOpen && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
          onTouchStart={e => {
            const startX = e.touches[0].clientX;
            const onEnd = (ev: TouchEvent) => {
              const diff = ev.changedTouches[0].clientX - startX;
              if (diff < -50 && photoIndex < sortedImages.length - 1) setPhotoIndex(i => i + 1);
              if (diff > 50 && photoIndex > 0) setPhotoIndex(i => i - 1);
              document.removeEventListener("touchend", onEnd);
            };
            document.addEventListener("touchend", onEnd);
          }}
        >
          <button
            onClick={() => setGalleryOpen(false)}
            className="absolute top-4 right-4 w-9 h-9 bg-white/20 text-white rounded-full flex items-center justify-center text-lg z-10"
            aria-label="Close gallery"
          >
            ✕
          </button>
          <img
            src={sortedImages[photoIndex]?.cloudinary_url}
            alt=""
            className="max-h-[80vh] max-w-full object-contain"
          />
          <p className="text-white/60 text-sm mt-4">
            {photoIndex + 1} / {sortedImages.length}
          </p>
          {/* Dot indicators */}
          <div className="flex gap-1.5 mt-3">
            {sortedImages.map((_, i) => (
              <button
                key={i}
                onClick={() => setPhotoIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === photoIndex ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
