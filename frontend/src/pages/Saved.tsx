import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PropertyCard, { PropertyCardData } from "../components/PropertyCard";
import SkeletonCard from "../components/SkeletonCard";

function getSavedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem("saved_properties") ?? "[]");
  } catch {
    return [];
  }
}

export function toggleSaved(id: string): boolean {
  const ids = getSavedIds();
  const next = ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id];
  localStorage.setItem("saved_properties", JSON.stringify(next));
  return next.includes(id);
}

export function isSaved(id: string): boolean {
  return getSavedIds().includes(id);
}

async function fetchSavedProperties(ids: string[]): Promise<PropertyCardData[]> {
  if (ids.length === 0) return [];
  const results = await Promise.allSettled(
    ids.map(id => fetch(`/api/properties/${id}`).then(r => r.ok ? r.json() : null))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value !== null)
    .map(r => ({
      ...r.value,
      primary_image: r.value.images?.find((i: any) => i.is_primary)?.cloudinary_url
        ?? r.value.images?.[0]?.cloudinary_url,
    }));
}

export default function Saved() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(getSavedIds());
    const onStorage = () => setIds(getSavedIds());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["saved", ids],
    queryFn: () => fetchSavedProperties(ids),
    enabled: ids.length > 0,
  });

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-20 px-4 pt-6">
      <h1 className="font-semibold text-[var(--text-primary)] mb-4">Saved homes</h1>

      {ids.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center space-y-3">
          <span className="text-5xl">❤️</span>
          <p className="font-medium text-[var(--text-primary)]">No saved homes yet</p>
          <p className="text-sm text-[var(--text-muted)] max-w-xs">
            Tap the heart on any property to save it here for later.
          </p>
        </div>
      )}

      {isLoading && ids.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {ids.map(id => <SkeletonCard key={id} />)}
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {data.map(p => <PropertyCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
