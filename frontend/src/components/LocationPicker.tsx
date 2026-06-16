import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Marker as LMarker } from "leaflet";

const NAIVASHA_LAT = -0.7127;
const NAIVASHA_LNG = 36.4310;

interface Props {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
}

function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  try {
    // @lat,lng,zoom — most share links
    const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };

    // ?q=lat,lng
    const q = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };

    // ll=lat,lng
    const ll = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (ll) return { lat: parseFloat(ll[1]), lng: parseFloat(ll[2]) };

    return null;
  } catch {
    return null;
  }
}

function loadLeafletCss() {
  if (document.getElementById("leaflet-css")) return;
  const link = document.createElement("link");
  link.id   = "leaflet-css";
  link.rel  = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

export default function LocationPicker({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LMap | null>(null);
  const markerRef    = useRef<LMarker | null>(null);
  const [open,      setOpen]      = useState(false);
  const [pasteUrl,  setPasteUrl]  = useState("");
  const [urlError,  setUrlError]  = useState("");

  // Initialise map when panel opens
  useEffect(() => {
    if (!open || !containerRef.current || mapRef.current) return;

    import("leaflet").then(L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      loadLeafletCss();

      const initLat = lat ? parseFloat(lat) : NAIVASHA_LAT;
      const initLng = lng ? parseFloat(lng) : NAIVASHA_LNG;
      const zoom    = lat ? 16 : 13;

      const map = L.map(containerRef.current!, { zoomControl: true, attributionControl: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      map.setView([initLat, initLng], zoom);
      mapRef.current = map;

      function placeMarker(clickLat: number, clickLng: number) {
        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng]);
        } else {
          markerRef.current = L.marker([clickLat, clickLng], { draggable: true }).addTo(map);
          markerRef.current.on("dragend", () => {
            const pos = markerRef.current!.getLatLng();
            onChange(pos.lat.toFixed(6), pos.lng.toFixed(6));
          });
        }
        onChange(clickLat.toFixed(6), clickLng.toFixed(6));
      }

      // Restore existing pin
      if (lat && lng) placeMarker(parseFloat(lat), parseFloat(lng));

      map.on("click", (e: any) => placeMarker(e.latlng.lat, e.latlng.lng));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep marker in sync when coords change from outside (e.g. URL paste)
  useEffect(() => {
    if (!mapRef.current || !lat || !lng) return;
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) return;

    import("leaflet").then(L => {
      if (markerRef.current) {
        markerRef.current.setLatLng([parsedLat, parsedLng]);
      } else {
        markerRef.current = L.marker([parsedLat, parsedLng], { draggable: true }).addTo(mapRef.current!);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLatLng();
          onChange(pos.lat.toFixed(6), pos.lng.toFixed(6));
        });
      }
      mapRef.current!.setView([parsedLat, parsedLng], 16);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  function handlePaste() {
    const coords = parseGoogleMapsUrl(pasteUrl.trim());
    if (coords) {
      onChange(String(coords.lat), String(coords.lng));
      setPasteUrl("");
      setUrlError("");
      if (!open) setOpen(true); // auto-open map to confirm
    } else {
      setUrlError("Couldn't read coordinates from this link — open map and tap your property instead.");
    }
  }

  const hasCoords = lat && lng;

  return (
    <div className="space-y-3">

      {/* Step 1 — paste Google Maps link */}
      <div>
        <p className="text-[13px] text-[var(--text-muted)] mb-1.5">
          Open Google Maps, long-press your property, tap <strong>Share</strong> and paste the link below:
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={pasteUrl}
            onChange={e => { setPasteUrl(e.target.value); setUrlError(""); }}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handlePaste())}
            placeholder="https://maps.google.com/..."
            className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--color-teal)] transition-colors"
          />
          <button type="button" onClick={handlePaste}
            className="px-4 py-2.5 bg-[var(--color-teal)] text-white text-sm font-semibold rounded-xl flex-shrink-0">
            Set
          </button>
        </div>
        {urlError && <p className="text-red-500 text-xs mt-1.5">{urlError}</p>}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-[12px] text-[var(--text-muted)]">or pick on map</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      {/* Step 2 — interactive map picker */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--text-primary)] text-sm font-medium py-2.5 rounded-xl transition-colors active:bg-[var(--bg-surface)]"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        {open ? "Close map" : hasCoords ? "Adjust pin on map" : "Tap to place pin"}
      </button>

      {open && (
        <div>
          <p className="text-[12px] text-[var(--text-muted)] mb-2">Tap anywhere on the map to place or move your pin.</p>
          <div ref={containerRef}
            className="w-full rounded-2xl overflow-hidden border border-[var(--border)]"
            style={{ height: 300 }}
          />
        </div>
      )}

      {/* Coordinates confirmed badge */}
      {hasCoords && (
        <div className="flex items-center gap-3 bg-[var(--color-forest)]/8 border border-[var(--color-forest)]/20 rounded-xl px-3 py-2.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-[var(--color-forest)] flex-shrink-0" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--color-forest)]">Pin saved</p>
            <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">
              {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}
            </p>
          </div>
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[var(--color-teal)] font-medium underline flex-shrink-0"
          >
            Verify ↗
          </a>
        </div>
      )}
    </div>
  );
}
