import { Link } from "react-router-dom";

export interface PropertyCardData {
  id: string;
  title: string;
  type: string;
  price_per_night: number;
  verified_tier: number;
  primary_image?: string;
  avg_rating?: number;
  review_count?: number;
}

export default function PropertyCard({ p }: { p: PropertyCardData }) {
  return (
    <Link to={`/property/${p.id}`} className="block rounded-2xl overflow-hidden bg-[var(--bg-surface)] shadow-sm active:scale-95 transition-transform">
      {/* Photo */}
      <div className="relative h-48 bg-gray-100 dark:bg-gray-800">
        {p.primary_image ? (
          <img src={p.primary_image} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-sm">No photo yet</div>
        )}
        {p.verified_tier >= 2 && (
          <span className="absolute top-2 left-2 bg-[var(--color-forest)] text-white text-xs font-medium px-2 py-0.5 rounded-full">
            ✓ Verified
          </span>
        )}
      </div>

      {/* Details */}
      <div className="p-3 space-y-1">
        <p className="text-xs text-[var(--text-muted)] capitalize">{p.type}</p>
        <h3 className="font-medium text-[var(--text-primary)] text-sm leading-snug line-clamp-2">{p.title}</h3>
        <div className="flex items-center justify-between pt-1">
          <p className="font-semibold text-[var(--text-primary)]">
            KES {p.price_per_night.toLocaleString()}
            <span className="font-normal text-[var(--text-muted)] text-xs"> /night</span>
          </p>
          {p.avg_rating && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-gold)]">
              ★ {p.avg_rating.toFixed(1)}
              {p.review_count ? <span className="text-[var(--text-muted)]">({p.review_count})</span> : null}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
