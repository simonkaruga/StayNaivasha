import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Routes, Route, NavLink, useNavigate, useParams } from "react-router-dom";
import { Home as HomeIcon, Sparkles, Clock, Camera } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  properties: number;
  bookings: number;
  total_earned: number;
  pending_payout: number;
  upcoming: UpcomingBooking[];
}

interface UpcomingBooking {
  id: string;
  property_id: string;
  check_in: string;
  check_out: string;
  checkin_code: string;
  status: string;
  total_amount: number;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api${path}`, { credentials: "include", ...opts });

async function fetchDashboard(): Promise<DashboardData> {
  const res = await api("/owner/dashboard");
  if (res.status === 401) throw new Error("unauth");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

// ── Sub-pages ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["owner-dash"], queryFn: fetchDashboard });
  const navigate = useNavigate();

  useEffect(() => {
    if (error?.message === "unauth") navigate("/profile?redirect=/owner");
  }, [error, navigate]);

  if (isLoading) return <LoadingSpinner />;
  if (error?.message === "unauth") return null;

  return (
    <div className="space-y-4">
      <h1 className="font-display italic text-2xl text-[var(--text-primary)]">Your dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Active listings", value: data?.properties ?? 0 },
          { label: "Total bookings", value: data?.bookings ?? 0 },
          { label: "Total earned (KES)", value: (data?.total_earned ?? 0).toLocaleString() },
          { label: "Pending payout", value: (data?.pending_payout ?? 0).toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[var(--bg-surface)] rounded-2xl p-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Empty state for new owners */}
      {data?.bookings === 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl p-6 text-center space-y-3">
          <HomeIcon className="w-8 h-8 text-[var(--color-forest)] mx-auto" />
          <p className="font-medium text-[var(--text-primary)]">Set up your listing to start earning</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-[var(--color-mint)] h-2 rounded-full" style={{ width: `${data?.properties ? 60 : 20}%` }} />
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {data?.properties ? "60% — Add more photos & get verified" : "20% — Create your first listing"}
          </p>
          <NavLink to="/owner/listing/new"
            className="inline-block bg-[var(--color-forest)] text-white text-sm font-medium px-6 py-2.5 rounded-xl">
            {data?.properties ? "Manage listing" : "Add your first home"}
          </NavLink>
        </div>
      )}

      {/* Upcoming bookings */}
      {(data?.upcoming?.length ?? 0) > 0 && (
        <div>
          <h2 className="font-semibold text-[var(--text-primary)] mb-3">Upcoming stays</h2>
          <div className="space-y-3">
            {data!.upcoming.map(b => (
              <div key={b.id} className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {b.check_in} → {b.check_out}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      KES {b.total_amount.toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs bg-[var(--color-mint)]/20 text-[var(--color-teal)] px-2 py-0.5 rounded-full font-medium">
                    {b.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-[var(--bg-primary)] rounded-xl px-3 py-2">
                  <p className="text-xs text-[var(--text-muted)]">Check-in code:</p>
                  <p className="font-mono font-bold text-lg text-[var(--color-forest)] tracking-widest">
                    {b.checkin_code}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NewListing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "", type: "cottage", price_per_night: "", description: "",
    lat: "", lng: "", what3words: "", landmark_instructions: "", min_nights: "1",
    no_checkout_days: "", response_time_hours: "", cancellation_policy: "moderate",
  });
  const [rawDetails, setRawDetails] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function generateDescription() {
    if (!rawDetails) return;
    setAiLoading(true);
    const res = await api("/owner/ai/description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_details: rawDetails,
        property_type: form.type,
        price_per_night: Number(form.price_per_night) || 5000,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      set("description", data.description);
    }
    setAiLoading(false);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    // Upload via Cloudinary unsigned upload preset — VITE_CLOUDINARY_CLOUD and VITE_CLOUDINARY_PRESET needed
    const cloud = (import.meta as any).env?.VITE_CLOUDINARY_CLOUD;
    const preset = (import.meta as any).env?.VITE_CLOUDINARY_PRESET ?? "staynaivasha";
    const urls: string[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", preset);
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          urls.push(data.secure_url);
        }
      } catch {
        // skip failed upload
      }
    }
    setUploadedImages(prev => [...prev, ...urls]);
    setUploading(false);
  }

  async function saveImages(propertyId: string, imageUrls: string[]) {
    for (let i = 0; i < imageUrls.length; i++) {
      await api("/owner/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          cloudinary_url: imageUrls[i],
          is_primary: i === 0,
          display_order: i,
        }),
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await api("/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price_per_night: Number(form.price_per_night),
        min_nights: Number(form.min_nights),
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        response_time_hours: form.response_time_hours ? Number(form.response_time_hours) : null,
        no_checkout_days: form.no_checkout_days || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      if (uploadedImages.length > 0) {
        await saveImages(saved.id, uploadedImages);
      }
      queryClient.invalidateQueries({ queryKey: ["owner-dash"] });
      queryClient.invalidateQueries({ queryKey: ["owner-properties"] });
      navigate("/owner");
    } else {
      const err = await res.json();
      setError(err.detail ?? "Failed to save listing");
    }
  }

  const types = ["cottage", "villa", "apartment", "conference", "campsite", "house"];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button type="button" onClick={() => navigate("/owner")} className="text-[var(--text-muted)] text-xl">‹</button>
        <h1 className="font-semibold text-[var(--text-primary)]">New listing</h1>
      </div>

      <Field label="Property title *">
        <input required value={form.title} onChange={e => set("title", e.target.value)}
          placeholder="e.g. Lakeside Cottage with Flamingo Views"
          className={inputCls} />
      </Field>

      <Field label="Property type">
        <select value={form.type} onChange={e => set("type", e.target.value)} className={inputCls}>
          {types.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </Field>

      <Field label="Price per night (KES) *">
        <input required type="number" min={500} value={form.price_per_night}
          onChange={e => set("price_per_night", e.target.value)}
          placeholder="e.g. 8500" className={inputCls} />
      </Field>

      <Field label="Minimum stay (nights)">
        <input type="number" min={1} value={form.min_nights}
          onChange={e => set("min_nights", e.target.value)} className={inputCls} />
      </Field>

      <Field label="Typical response time (hours)">
        <input type="number" min={1} max={72} value={form.response_time_hours}
          onChange={e => set("response_time_hours", e.target.value)}
          placeholder="e.g. 2" className={inputCls} />
      </Field>

      <Field label="Cancellation policy">
        <select value={form.cancellation_policy} onChange={e => set("cancellation_policy", e.target.value)} className={inputCls}>
          <option value="flexible">Flexible — full refund up to 24h before check-in</option>
          <option value="moderate">Moderate — full refund up to 5 days before</option>
          <option value="strict">Strict — 50% refund up to 7 days before</option>
        </select>
      </Field>

      <Field label="No checkout on (optional)">
        <div className="space-y-1">
          <div className="flex flex-wrap gap-2">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day, i) => {
              const days = form.no_checkout_days ? form.no_checkout_days.split(",").filter(Boolean) : [];
              const checked = days.includes(String(i));
              return (
                <button key={i} type="button"
                  onClick={() => {
                    const next = checked ? days.filter(d => d !== String(i)) : [...days, String(i)];
                    set("no_checkout_days", next.join(","));
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${checked ? "bg-[var(--color-forest)] text-white border-[var(--color-forest)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
                  {day}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--text-muted)]">Guests cannot check out on selected days</p>
        </div>
      </Field>

      {/* AI description writer */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Description
          <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-[var(--color-teal)] font-normal"><Sparkles className="w-3 h-3" /> AI writer</span>
        </p>
        <textarea value={rawDetails} onChange={e => setRawDetails(e.target.value)}
          placeholder="Tell AI what you have: 3 bed, lake view, sleeps 6, wifi, bbq, 2km from Hell's Gate…"
          rows={2} className={`${inputCls} resize-none`} />
        <button type="button" onClick={generateDescription} disabled={aiLoading || !rawDetails}
          className="text-xs text-[var(--color-teal)] font-medium disabled:opacity-40">
          {aiLoading ? "Writing…" : <><Sparkles className="w-3.5 h-3.5 inline mr-1" />Generate description</>}
        </button>
        <textarea value={form.description} onChange={e => set("description", e.target.value)}
          placeholder="Or write your own description…"
          rows={4} className={`${inputCls} resize-none`} />
      </div>

      {/* GPS */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">Location</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Latitude">
            <input type="number" step="any" value={form.lat}
              onChange={e => set("lat", e.target.value)} placeholder="-0.7297" className={inputCls} />
          </Field>
          <Field label="Longitude">
            <input type="number" step="any" value={form.lng}
              onChange={e => set("lng", e.target.value)} placeholder="36.4311" className={inputCls} />
          </Field>
        </div>
        <Field label="What3words (optional)">
          <input value={form.what3words} onChange={e => set("what3words", e.target.value)}
            placeholder="e.g. lake.gate.path" className={inputCls} />
        </Field>
        <Field label="Landmark directions">
          <textarea value={form.landmark_instructions}
            onChange={e => set("landmark_instructions", e.target.value)}
            placeholder="e.g. From Total petrol station, green gate 200m on left"
            rows={2} className={`${inputCls} resize-none`} />
        </Field>
      </div>

      {/* Photos */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Photos
            <span className="ml-2 text-xs text-[var(--text-muted)]">{uploadedImages.length}/8 minimum</span>
          </p>
        </div>
        <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 cursor-pointer transition-colors ${uploading ? "opacity-50" : "border-[var(--border)] hover:border-[var(--color-teal)]"}`}>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
          {uploading ? <Clock className="w-6 h-6 text-[var(--text-muted)]" /> : <Camera className="w-6 h-6 text-[var(--text-muted)]" />}
          <span className="text-xs text-[var(--text-muted)]">{uploading ? "Uploading…" : "Tap to add photos (natural daylight, every room + view)"}</span>
        </label>
        {uploadedImages.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {uploadedImages.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                <img src={url} alt="" className="w-full h-full object-cover" />
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] bg-[var(--color-forest)] text-white py-0.5">Primary</span>
                )}
                <button type="button" onClick={() => setUploadedImages(imgs => imgs.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center leading-none">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {uploadedImages.length > 0 && uploadedImages.length < 8 && (
          <p className="text-xs text-amber-600">Add {8 - uploadedImages.length} more photo{8 - uploadedImages.length !== 1 ? "s" : ""} — minimum 8 required for approval</p>
        )}
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <p className="text-xs text-[var(--text-muted)] text-center">
        Your listing goes live after admin review
      </p>

      <button type="submit" disabled={saving || uploading}
        className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-semibold py-3.5 rounded-2xl text-sm">
        {saving ? "Saving…" : "Save listing"}
      </button>
    </form>
  );
}

// ── Edit listing ─────────────────────────────────────────────────────────────

function EditListing() {
  const { propId }    = useParams<{ propId: string }>();
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const [form, setForm] = useState({
    title: "", type: "cottage", price_per_night: "", description: "",
    lat: "", lng: "", what3words: "", landmark_instructions: "", min_nights: "1",
    no_checkout_days: "", response_time_hours: "", cancellation_policy: "moderate",
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [loaded,  setLoaded]  = useState(false);

  // Load existing data
  useEffect(() => {
    if (!propId) return;
    api(`/properties/${propId}`).then(r => r.ok ? r.json() : null).then((p: any) => {
      if (!p) return;
      setForm({
        title: p.title ?? "",
        type: p.type ?? "cottage",
        price_per_night: String(p.price_per_night ?? ""),
        description: p.description ?? "",
        lat: p.lat != null ? String(p.lat) : "",
        lng: p.lng != null ? String(p.lng) : "",
        what3words: p.what3words ?? "",
        landmark_instructions: p.landmark_instructions ?? "",
        min_nights: String(p.min_nights ?? 1),
        no_checkout_days: p.no_checkout_days ?? "",
        response_time_hours: p.response_time_hours != null ? String(p.response_time_hours) : "",
        cancellation_policy: p.cancellation_policy ?? "moderate",
      });
      setLoaded(true);
    });
  }, [propId]);

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const r = await api(`/properties/${propId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price_per_night: Number(form.price_per_night),
        min_nights: Number(form.min_nights),
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        response_time_hours: form.response_time_hours ? Number(form.response_time_hours) : null,
        no_checkout_days: form.no_checkout_days || null,
      }),
    });
    setSaving(false);
    if (r.ok) {
      queryClient.invalidateQueries({ queryKey: ["owner-properties"] });
      navigate("/owner/listings");
    } else {
      const d = await r.json(); setError(d.detail ?? "Failed to save");
    }
  }

  if (!loaded) return <LoadingSpinner />;

  const types = ["cottage","villa","apartment","conference","campsite","house"];

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button type="button" onClick={() => navigate("/owner/listings")} className="text-[var(--text-muted)] text-xl">‹</button>
        <h1 className="font-semibold text-[var(--text-primary)]">Edit listing</h1>
      </div>

      <Field label="Property title *">
        <input required value={form.title} onChange={e => set("title", e.target.value)}
          className={inputCls} />
      </Field>

      <Field label="Property type">
        <select value={form.type} onChange={e => set("type", e.target.value)} className={inputCls}>
          {types.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </Field>

      <Field label="Price per night (KES) *">
        <input required type="number" min={500} value={form.price_per_night}
          onChange={e => set("price_per_night", e.target.value)} className={inputCls} />
      </Field>

      <Field label="Minimum stay (nights)">
        <input type="number" min={1} value={form.min_nights}
          onChange={e => set("min_nights", e.target.value)} className={inputCls} />
      </Field>

      <Field label="Typical response time (hours)">
        <input type="number" min={1} max={72} value={form.response_time_hours}
          onChange={e => set("response_time_hours", e.target.value)}
          placeholder="e.g. 2" className={inputCls} />
      </Field>

      <Field label="Cancellation policy">
        <select value={form.cancellation_policy} onChange={e => set("cancellation_policy", e.target.value)} className={inputCls}>
          <option value="flexible">Flexible — full refund up to 24h before check-in</option>
          <option value="moderate">Moderate — full refund up to 5 days before</option>
          <option value="strict">Strict — 50% refund up to 7 days before</option>
        </select>
      </Field>

      <Field label="No checkout on (optional)">
        <div className="space-y-1">
          <div className="flex flex-wrap gap-2">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day, i) => {
              const days = form.no_checkout_days ? form.no_checkout_days.split(",").filter(Boolean) : [];
              const checked = days.includes(String(i));
              return (
                <button key={i} type="button"
                  onClick={() => {
                    const next = checked ? days.filter(d => d !== String(i)) : [...days, String(i)];
                    set("no_checkout_days", next.join(","));
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${checked ? "bg-[var(--color-forest)] text-white border-[var(--color-forest)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
                  {day}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--text-muted)]">Guests cannot check out on selected days</p>
        </div>
      </Field>

      <Field label="Description">
        <textarea value={form.description} onChange={e => set("description", e.target.value)}
          rows={4} className={`${inputCls} resize-none`} />
      </Field>

      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">Location</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Latitude">
            <input type="number" step="any" value={form.lat}
              onChange={e => set("lat", e.target.value)} placeholder="-0.7297" className={inputCls} />
          </Field>
          <Field label="Longitude">
            <input type="number" step="any" value={form.lng}
              onChange={e => set("lng", e.target.value)} placeholder="36.4311" className={inputCls} />
          </Field>
        </div>
        <Field label="What3words (optional)">
          <input value={form.what3words} onChange={e => set("what3words", e.target.value)}
            placeholder="e.g. lake.gate.path" className={inputCls} />
        </Field>
        <Field label="Landmark directions">
          <textarea value={form.landmark_instructions} onChange={e => set("landmark_instructions", e.target.value)}
            rows={2} className={`${inputCls} resize-none`} />
        </Field>
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <button type="submit" disabled={saving}
        className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-bold py-3.5 rounded-2xl text-sm">
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

// ── Owner bookings list ──────────────────────────────────────────────────────

function OwnerBookings() {
  const [selectedProp, setSelectedProp] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState<Record<string, string>>({});
  const [checkinError, setCheckinError] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { data: myProps } = useOwnerProperties();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["owner-bookings", selectedProp],
    queryFn: async () => {
      const res = await api(`/owner/bookings${selectedProp ? `?property_id=${selectedProp}` : ""}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function confirmCheckin(bookingId: string) {
    const code = codeInput[bookingId] ?? "";
    if (code.length !== 4) { setCheckinError(e => ({ ...e, [bookingId]: "Enter the 4-digit code" })); return; }
    setConfirmingId(bookingId);
    setCheckinError(e => ({ ...e, [bookingId]: "" }));
    const res = await api(`/bookings/${bookingId}/checkin?code=${code}`, { method: "POST" });
    setConfirmingId(null);
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["owner-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["owner-dash"] });
    } else {
      setCheckinError(e => ({ ...e, [bookingId]: "Wrong code — ask guest to check their confirmation" }));
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-blue-100 text-blue-700",
    checked_in: "bg-[var(--color-mint)]/20 text-[var(--color-teal)]",
    completed: "bg-gray-100 text-gray-600",
    cancelled: "bg-red-100 text-red-600",
  };

  return (
    <div className="space-y-4">
      <h1 className="font-semibold text-[var(--text-primary)]">All bookings</h1>

      {(myProps?.length ?? 0) > 0 && (
        <select value={selectedProp} onChange={e => setSelectedProp(e.target.value)} className={inputCls}>
          <option value="">All properties</option>
          {myProps!.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      )}

      {isLoading && <LoadingSpinner />}

      {!isLoading && bookings?.length === 0 && (
        <p className="text-center text-[var(--text-muted)] text-sm py-8">No bookings yet.</p>
      )}

      <div className="space-y-3">
        {bookings?.map((b: any) => (
          <div key={b.id} className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{b.check_in} → {b.check_out}</p>
                <p className="text-xs text-[var(--text-muted)]">KES {b.total_amount?.toLocaleString()}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                {b.status}
              </span>
            </div>

            {/* Confirm check-in — owner enters guest's 4-digit code to release escrow */}
            {b.status === "confirmed" && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-[var(--text-muted)]">Guest shows you their code — enter it to confirm arrival and release payout:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4-digit code"
                    value={codeInput[b.id] ?? ""}
                    onChange={e => setCodeInput(c => ({ ...c, [b.id]: e.target.value.replace(/\D/g, "") }))}
                    className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm font-mono tracking-widest outline-none"
                  />
                  <button
                    onClick={() => confirmCheckin(b.id)}
                    disabled={confirmingId === b.id}
                    className="bg-[var(--color-forest)] disabled:bg-gray-300 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                  >
                    {confirmingId === b.id ? "…" : "Confirm"}
                  </button>
                </div>
                {checkinError[b.id] && (
                  <p className="text-red-500 text-xs">{checkinError[b.id]}</p>
                )}
              </div>
            )}

            {b.status === "checked_in" && (
              <p className="text-xs text-[var(--color-teal)]">✓ Guest checked in — payout processing</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


// ── Earnings breakdown ────────────────────────────────────────────────────────

function Earnings() {
  const { data, isLoading } = useQuery({
    queryKey: ["owner-dash"],
    queryFn: async () => {
      const res = await api("/owner/dashboard");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  if (isLoading) return <LoadingSpinner />;

  const items = [
    { label: "Total earned", value: data?.total_earned ?? 0, note: "Completed stays" },
    { label: "Pending payout", value: data?.pending_payout ?? 0, note: "Guests checked in — releasing soon" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="font-semibold text-[var(--text-primary)]">Earnings</h1>
      {items.map(({ label, value, note }) => (
        <div key={label} className="bg-[var(--bg-surface)] rounded-2xl p-5">
          <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
          <p className="text-3xl font-bold text-[var(--text-primary)]">KES {value.toLocaleString()}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{note}</p>
        </div>
      ))}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4">
        <p className="text-xs font-medium text-[var(--text-primary)] mb-2">Payout schedule</p>
        <ul className="text-xs text-[var(--text-muted)] space-y-1 list-disc pl-4">
          <li>Payouts released via M-Pesa after guest checks in</li>
          <li>Platform fee: KES 300/booking</li>
          <li>Tourism levy: 2% deducted from gross</li>
        </ul>
      </div>
    </div>
  );
}


// ── Availability calendar ─────────────────────────────────────────────────────

function useOwnerProperties() {
  return useQuery({
    queryKey: ["owner-properties"],
    queryFn: async () => {
      const res = await api("/properties?owner=me");
      if (!res.ok) return [] as { id: string; title: string }[];
      return res.json() as Promise<{ id: string; title: string }[]>;
    },
  });
}

function OwnerCalendar() {
  const [propertyId, setPropertyId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth()); // 0-indexed
  const [toggling, setToggling] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: myProps } = useOwnerProperties();

  const { data: avail } = useQuery({
    queryKey: ["avail", propertyId, year, month],
    queryFn: async () => {
      if (!propertyId) return [];
      const res = await api(`/properties/${propertyId}/availability?year=${year}&month=${month + 1}`);
      if (!res.ok) return [];
      return res.json() as Promise<{ date: string; is_blocked: boolean; source: string }[]>;
    },
    enabled: !!propertyId,
  });

  const blockedSet = new Set((avail ?? []).filter(a => a.is_blocked).map(a => a.date));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  async function toggleDate(dateStr: string) {
    if (!propertyId) return;
    setToggling(dateStr);
    const isBlocked = blockedSet.has(dateStr);
    await api("/owner/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, date: dateStr, is_blocked: !isBlocked }),
    });
    queryClient.invalidateQueries({ queryKey: ["avail", propertyId, year, month] });
    setToggling(null);
  }

  const monthName = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <h1 className="font-semibold text-[var(--text-primary)]">Availability</h1>

      <Field label="Property">
        <select value={propertyId} onChange={e => setPropertyId(e.target.value)} className={inputCls}>
          <option value="">Select a property</option>
          {(myProps ?? []).map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </Field>

      <div className="flex items-center justify-between">
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}
          className="text-[var(--text-muted)] px-3 py-1 text-lg">‹</button>
        <p className="text-sm font-medium text-[var(--text-primary)]">{monthName}</p>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}
          className="text-[var(--text-muted)] px-3 py-1 text-lg">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} className="text-xs text-[var(--text-muted)] py-1">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const blocked = blockedSet.has(dateStr);
          const loading = toggling === dateStr;
          return (
            <button key={day} onClick={() => toggleDate(dateStr)} disabled={loading || !propertyId}
              className={`rounded-lg py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                blocked ? "bg-red-100 text-red-600" : "bg-[var(--color-mint)]/20 text-[var(--color-teal)]"
              }`}>
              {loading ? "…" : day}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[var(--color-mint)]/20 inline-block" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 inline-block" /> Blocked</span>
      </div>

      {!propertyId && (
        <p className="text-xs text-[var(--text-muted)] text-center">Enter a property ID above to manage dates.</p>
      )}
    </div>
  );
}


function ICalSync() {
  const [propertyId, setPropertyId] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const { data: myProps } = useOwnerProperties();

  async function handleImport() {
    if (!propertyId || !url) return;
    setStatus("loading");
    const res = await api("/ical/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, ical_url: url }),
    });
    setStatus(res.ok ? "ok" : "error");
  }

  return (
    <div className="space-y-4">
      <h1 className="font-semibold text-[var(--text-primary)]">iCal sync</h1>
      <p className="text-sm text-[var(--text-muted)]">
        Paste your Airbnb or Booking.com calendar URL to automatically block those dates here.
        We sync every 2 hours.
      </p>

      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
        <Field label="Property">
          <select value={propertyId} onChange={e => setPropertyId(e.target.value)} className={inputCls}>
            <option value="">Select a property</option>
            {(myProps ?? []).map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </Field>
        <Field label="iCal URL (from Airbnb / Booking.com)">
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://www.airbnb.com/calendar/ical/..." className={inputCls} />
        </Field>
        <button onClick={handleImport} disabled={status === "loading" || !propertyId || !url}
          className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl text-sm">
          {status === "loading" ? "Syncing…" : "Import & sync now"}
        </button>
        {status === "ok" && <p className="text-[var(--color-teal)] text-sm text-center">✓ Synced! Dates are now blocked.</p>}
        {status === "error" && <p className="text-red-500 text-sm text-center">Could not fetch that URL — make sure it's public.</p>}
      </div>

      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">Export your StayNaivasha calendar</p>
        <p className="text-xs text-[var(--text-muted)]">
          Copy the URL below and paste into Airbnb/Booking.com as an external calendar.
        </p>
        <div className="bg-[var(--bg-primary)] rounded-xl px-3 py-2 flex items-center gap-2">
          <p className="text-xs text-[var(--text-muted)] flex-1 truncate font-mono">
            https://staynaivasha.co.ke/api/ical/{"{your-property-id}"}
          </p>
          <button onClick={() => navigator.clipboard.writeText(`https://staynaivasha.co.ke/api/ical/${propertyId}`)}
            className="text-xs text-[var(--color-teal)] font-medium flex-shrink-0">
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

// ── My listings ───────────────────────────────────────────────────────────────

function MyListings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: myProps, isLoading } = useOwnerProperties();

  async function toggleActive(id: string, currentActive: boolean) {
    // Admin must approve listings — owners can only deactivate their own
    if (!currentActive) {
      alert("Listings can only be reactivated by admin after review. Contact support.");
      return;
    }
    await api(`/properties/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    queryClient.invalidateQueries({ queryKey: ["owner-properties"] });
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-[var(--text-primary)]">My listings</h1>
        <NavLink to="/owner/listing/new"
          className="text-xs bg-[var(--color-forest)] text-white px-3 py-1.5 rounded-xl font-medium">
          + New
        </NavLink>
      </div>

      {(!myProps || myProps.length === 0) && (
        <div className="flex flex-col items-center py-12 text-center space-y-3">
          <HomeIcon className="w-10 h-10 text-[var(--color-forest)] mx-auto" />
          <p className="font-medium text-[var(--text-primary)]">No listings yet</p>
          <NavLink to="/owner/listing/new"
            className="bg-[var(--color-forest)] text-white text-sm font-medium px-6 py-2.5 rounded-xl">
            Add your first home
          </NavLink>
        </div>
      )}

      <div className="space-y-3">
        {myProps?.map((p: any) => (
          <div key={p.id} className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-[var(--text-primary)] text-sm truncate">{p.title}</p>
                <p className="text-xs text-[var(--text-muted)] capitalize mt-0.5">
                  {p.type} · KES {p.price_per_night?.toLocaleString()}/night
                </p>
              </div>
              <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                p.active ? "bg-[var(--color-mint)]/20 text-[var(--color-teal)]" : "bg-yellow-100 text-yellow-700"
              }`}>
                {p.active ? "Live" : "Pending review"}
              </span>
            </div>
            {p.verified_tier > 0 && (
              <p className="text-xs text-[var(--color-forest)]">✓ Tier {p.verified_tier} verified</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => navigate(`/owner/listing/edit/${p.id}`)}
                className="flex-1 border border-[var(--border)] text-[var(--text-muted)] text-xs py-2 rounded-xl"
              >
                Edit
              </button>
              {p.active && (
                <button
                  onClick={() => toggleActive(p.id, p.active)}
                  className="flex-1 border border-red-200 text-red-600 text-xs py-2 rounded-xl"
                >
                  Deactivate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Damage claims ─────────────────────────────────────────────────────────────

interface DamageClaimRecord {
  id: string;
  booking_id: string;
  check_in: string | null;
  claimed_amount: number;
  status: "pending" | "approved" | "rejected";
  description: string | null;
  created_at: string;
}

function DamageClaims() {
  const [bookingId, setBookingId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);
  const queryClient = useQueryClient();

  const { data: claims, isLoading } = useQuery<DamageClaimRecord[]>({
    queryKey: ["owner-damage-claims"],
    queryFn: async () => {
      const res = await api("/owner/damage-claims");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: myProps } = useOwnerProperties();

  const [selectedProp, setSelectedProp] = useState("");
  const { data: bookings } = useQuery({
    queryKey: ["owner-completed-bookings", selectedProp],
    queryFn: async () => {
      const res = await api(`/owner/bookings${selectedProp ? `?property_id=${selectedProp}` : ""}`);
      if (!res.ok) return [];
      const all: any[] = await res.json();
      return all.filter(b => b.status === "checked_in" || b.status === "completed");
    },
    enabled: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingId || !amount) { setFormError("Select a booking and enter an amount"); return; }
    setSubmitting(true); setFormError("");
    const res = await api("/owner/damage-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, claimed_amount: Number(amount), description }),
    });
    setSubmitting(false);
    if (res.ok) {
      setFormSuccess(true);
      setBookingId(""); setAmount(""); setDescription("");
      queryClient.invalidateQueries({ queryKey: ["owner-damage-claims"] });
    } else {
      const err = await res.json();
      setFormError(err.detail ?? "Failed to submit claim");
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-[var(--color-mint)]/20 text-[var(--color-teal)]",
    rejected: "bg-red-100 text-red-600",
  };

  return (
    <div className="space-y-6">
      <h1 className="font-semibold text-[var(--text-primary)]">Damage claims</h1>

      {/* File new claim */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">File a new claim</p>
        <p className="text-xs text-[var(--text-muted)]">
          Report damage after a guest checks in or completes their stay. Admin will review and mediate.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Filter by property">
            <select value={selectedProp} onChange={e => setSelectedProp(e.target.value)} className={inputCls}>
              <option value="">All properties</option>
              {(myProps ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Booking *">
            <select value={bookingId} onChange={e => setBookingId(e.target.value)} className={inputCls}>
              <option value="">Select a completed booking</option>
              {(bookings ?? []).map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.check_in} → {b.check_out} · KES {b.total_amount?.toLocaleString()} ({b.status})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Claimed amount (KES) *">
            <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 15000" className={inputCls} />
          </Field>
          <Field label="Description of damage">
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="Describe what was damaged and how it was caused…"
              className={`${inputCls} resize-none`} />
          </Field>
          {formError && <p className="text-red-500 text-xs">{formError}</p>}
          {formSuccess && <p className="text-[var(--color-teal)] text-xs">✓ Claim submitted — admin will review within 48 hours.</p>}
          <button type="submit" disabled={submitting}
            className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl text-sm">
            {submitting ? "Submitting…" : "Submit claim"}
          </button>
        </form>
      </div>

      {/* Existing claims */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">Your claims</p>
        {isLoading && <LoadingSpinner />}
        {!isLoading && (claims?.length ?? 0) === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center py-6">No claims filed yet.</p>
        )}
        {claims?.map(c => (
          <div key={c.id} className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-1.5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  KES {c.claimed_amount.toLocaleString()}
                </p>
                {c.check_in && (
                  <p className="text-xs text-[var(--text-muted)]">Stay: {c.check_in}</p>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>
                {c.status}
              </span>
            </div>
            {c.description && (
              <p className="text-xs text-[var(--text-muted)]">{c.description}</p>
            )}
            <p className="text-xs text-[var(--text-muted)]">
              Filed {new Date(c.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Owner nav ─────────────────────────────────────────────────────────────────

const ownerTabs = [
  { to: "/owner", label: "Home", end: true },
  { to: "/owner/listings", label: "Listings" },
  { to: "/owner/listing/new", label: "+ New" },
  { to: "/owner/bookings", label: "Bookings" },
  { to: "/owner/earnings", label: "Earnings" },
  { to: "/owner/calendar", label: "Calendar" },
  { to: "/owner/ical", label: "iCal" },
  { to: "/owner/claims", label: "Claims" },
];

// ── Layout ────────────────────────────────────────────────────────────────────

export default function OwnerLayout() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Top nav */}
      <div className="sticky top-0 z-40 bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <p className="font-display italic text-lg text-[var(--color-forest)]">StayNaivasha</p>
        <div className="flex gap-4 overflow-x-auto scrollbar-none">
          {ownerTabs.map(t => (
            <NavLink key={t.to} to={t.to} end={t.end}
              className={({ isActive }) =>
                `flex-shrink-0 text-sm font-medium ${isActive ? "text-[var(--color-forest)]" : "text-[var(--text-muted)]"}`}>
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/listings" element={<MyListings />} />
          <Route path="/listing/new" element={<NewListing />} />
          <Route path="/listing/edit/:propId" element={<EditListing />} />
          <Route path="/bookings" element={<OwnerBookings />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/calendar" element={<OwnerCalendar />} />
          <Route path="/ical" element={<ICalSync />} />
          <Route path="/claims" element={<DamageClaims />} />
        </Routes>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = "w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--color-teal)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[var(--text-muted)] font-medium">{label}</label>
      {children}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-[var(--color-mint)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
