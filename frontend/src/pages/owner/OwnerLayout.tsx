import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Routes, Route, NavLink, useNavigate, useParams } from "react-router-dom";
import {
  Home as HomeIcon, Sparkles,
  Building2, CalendarDays, TrendingUp, LayoutGrid,
  Link2, AlertCircle, ChevronRight, ExternalLink,
} from "lucide-react";
import PhotoUploader, { UploadedPhoto } from "../../components/PhotoUploader";
import LocationPicker from "../../components/LocationPicker";

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

      {/* Quick block — prominent card for owners who also list on Airbnb/Booking.com */}
      <QuickBlockCard />

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

// ── Quick block card (shown on dashboard for multi-platform owners) ────────────

function QuickBlockCard() {
  const { data: myProps } = useOwnerProperties();
  const [open,       setOpen]       = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [checkIn,    setCheckIn]    = useState("");
  const [checkOut,   setCheckOut]   = useState("");
  const [saving,     setSaving]     = useState(false);
  const [result,     setResult]     = useState<"ok" | "error" | null>(null);

  async function block() {
    if (!propertyId || !checkIn || !checkOut) return;
    setSaving(true); setResult(null);
    const res = await api("/owner/block-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, check_in: checkIn, check_out: checkOut }),
    });
    setResult(res.ok ? "ok" : "error");
    setSaving(false);
    if (res.ok) { setCheckIn(""); setCheckOut(""); }
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-[#d4892a]/25"
      style={{ background: "rgba(212,137,42,0.06)" }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(212,137,42,0.15)" }}>
            <AlertCircle size={16} className="text-[#d4892a]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Got a booking on Airbnb?</p>
            <p className="text-xs text-[var(--text-muted)]">Block those dates here instantly</p>
          </div>
        </div>
        <ChevronRight size={16} className={`text-[var(--text-muted)] transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#d4892a]/15 pt-3">
          <p className="text-xs text-[var(--text-muted)]">
            Or text <span className="font-mono font-semibold text-[var(--text-primary)]">BLOCK [code] [from] [to]</span> to our WhatsApp number — works even faster.
          </p>
          <Field label="Property">
            <select value={propertyId} onChange={e => setPropertyId(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {(myProps ?? []).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Check-in">
              <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
                min={new Date().toISOString().split("T")[0]} className={inputCls} />
            </Field>
            <Field label="Check-out">
              <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
                min={checkIn} className={inputCls} />
            </Field>
          </div>
          <button onClick={block} disabled={saving || !propertyId || !checkIn || !checkOut}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
            style={{ background: "#d4892a" }}>
            {saving ? "Blocking…" : "Block these dates now"}
          </button>
          {result === "ok"    && <p className="text-sm text-[var(--color-teal)] text-center">Done — dates are blocked. No new bookings can come in.</p>}
          {result === "error" && <p className="text-sm text-red-500 text-center">Something went wrong. Try again.</p>}
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
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

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

  async function saveImages(propertyId: string, readyPhotos: UploadedPhoto[]) {
    for (let i = 0; i < readyPhotos.length; i++) {
      await api("/owner/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          cloudinary_url: readyPhotos[i].url,
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
      const readyPhotos = photos.filter(p => p.done && !p.error && p.url);
      if (readyPhotos.length > 0) {
        await saveImages(saved.id, readyPhotos);
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
          placeholder="e.g. Lakeside Cottage with Hippo Views"
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

      {/* Location */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">Location pin</p>
        <LocationPicker
          lat={form.lat}
          lng={form.lng}
          onChange={(lat, lng) => { set("lat", lat); set("lng", lng); }}
        />
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
        <p className="text-sm font-medium text-[var(--text-primary)]">Photos &amp; videos</p>
        <PhotoUploader value={photos} onChange={setPhotos} />
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <p className="text-xs text-[var(--text-muted)] text-center">
        Your listing goes live after admin review
      </p>

      <button type="submit" disabled={saving || photos.some(p => !p.done)}
        className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-semibold py-3.5 rounded-2xl text-sm">
        {saving ? "Saving…" : photos.some(p => !p.done) ? "Uploading photos…" : "Save listing"}
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
  const [newPhotos, setNewPhotos] = useState<UploadedPhoto[]>([]);

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
    if (r.ok && propId) {
      const readyPhotos = newPhotos.filter(p => p.done && !p.error && p.url);
      for (let i = 0; i < readyPhotos.length; i++) {
        await api("/owner/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_id: propId,
            cloudinary_url: readyPhotos[i].url,
            is_primary: false,
            display_order: 999 + i,
          }),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["owner-properties"] });
      navigate("/owner/listings");
    } else if (!r.ok) {
      const d = await r.json(); setError(d.detail ?? "Failed to save");
    }
    setSaving(false);
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
        <p className="text-sm font-medium text-[var(--text-primary)]">Location pin</p>
        <LocationPicker
          lat={form.lat}
          lng={form.lng}
          onChange={(lat, lng) => { set("lat", lat); set("lng", lng); }}
        />
        <Field label="What3words (optional)">
          <input value={form.what3words} onChange={e => set("what3words", e.target.value)}
            placeholder="e.g. lake.gate.path" className={inputCls} />
        </Field>
        <Field label="Landmark directions">
          <textarea value={form.landmark_instructions} onChange={e => set("landmark_instructions", e.target.value)}
            placeholder="e.g. From Total petrol station, green gate 200m on left"
            rows={2} className={`${inputCls} resize-none`} />
        </Field>
      </div>

      {/* Add more photos */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">Add more photos &amp; videos</p>
        <p className="text-[13px] text-[var(--text-muted)]">New photos are added to the existing gallery</p>
        <PhotoUploader value={newPhotos} onChange={setNewPhotos} />
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <button type="submit" disabled={saving || newPhotos.some(p => !p.done)}
        className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-bold py-3.5 rounded-2xl text-sm">
        {saving ? "Saving…" : newPhotos.some(p => !p.done) ? "Uploading photos…" : "Save changes"}
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


const PLATFORM_LABELS: Record<string, { label: string; color: string; hint: string }> = {
  airbnb:  { label: "Airbnb",       color: "#FF5A5F", hint: "Airbnb → Calendar → Export calendar" },
  booking: { label: "Booking.com",  color: "#003580", hint: "Booking.com → Calendar → iCal" },
  vrbo:    { label: "VRBO",         color: "#1C5E8C", hint: "VRBO → Calendars → Export" },
  other:   { label: "Other",        color: "#6B7280", hint: "Any iCal (.ics) URL" },
};

interface ExternalCal { id: string; platform: string; ical_url: string; last_synced_at: string | null; }

function ICalSync() {
  const [propertyId, setPropertyId] = useState("");
  const [platform,   setPlatform]   = useState("airbnb");
  const [url,        setUrl]        = useState("");
  const [addStatus,  setAddStatus]  = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [calendars,  setCalendars]  = useState<ExternalCal[]>([]);
  const [copied,     setCopied]     = useState(false);
  const { data: myProps } = useOwnerProperties();

  useEffect(() => {
    if (!propertyId) return;
    api(`/ical/calendars/${propertyId}`).then(r => r.ok ? r.json() : []).then(setCalendars);
  }, [propertyId, addStatus]);

  async function handleAdd() {
    if (!propertyId || !url) return;
    setAddStatus("loading");
    const res = await api("/ical/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, platform, ical_url: url }),
    });
    setAddStatus(res.ok ? "ok" : "error");
    if (res.ok) setUrl("");
  }

  async function handleRemove(calId: string) {
    await api(`/ical/calendars/${calId}`, { method: "DELETE" });
    setCalendars(c => c.filter(x => x.id !== calId));
  }

  function copyExportUrl() {
    navigator.clipboard.writeText(`https://staynaivasha.co.ke/api/ical/export/${propertyId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const exportUrl = `https://staynaivasha.co.ke/api/ical/export/${propertyId}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-semibold text-[var(--text-primary)] text-lg">Calendar sync</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Connect every platform you list on. We sync every <strong>30 minutes</strong> and alert you
          immediately on WhatsApp if a double-booking is detected.
        </p>
      </div>

      {/* How it prevents double-bookings */}
      <div className="rounded-2xl p-4 space-y-2.5"
        style={{ background: "rgba(30,74,34,0.06)", border: "1px solid rgba(30,74,34,0.14)" }}>
        <p className="text-sm font-semibold text-[var(--color-forest)]">How double-booking protection works</p>
        {[
          "Paste each platform's iCal URL below — we import their blocked dates automatically",
          "Copy your StayNaivasha export URL and paste it into Airbnb & Booking.com as an external calendar",
          "We sync every 30 minutes both ways. If a conflict is ever found, you get a WhatsApp alert instantly",
        ].map((s, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 mt-0.5"
              style={{ background: "#1e4a22" }}>{i + 1}</span>
            <p className="text-sm text-[var(--text-muted)]">{s}</p>
          </div>
        ))}
      </div>

      {/* Property selector */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
        <Field label="Select property">
          <select value={propertyId} onChange={e => { setPropertyId(e.target.value); setAddStatus("idle"); }} className={inputCls}>
            <option value="">Choose a property…</option>
            {(myProps ?? []).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </Field>
      </div>

      {propertyId && (
        <>
          {/* Connected calendars list */}
          <div className="bg-[var(--bg-surface)] rounded-2xl overflow-hidden">
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide px-4 pt-4 pb-2">
              Connected platforms
            </p>
            {calendars.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] px-4 pb-4">None yet — add your first one below.</p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {calendars.map(c => {
                  const pl = PLATFORM_LABELS[c.platform] ?? PLATFORM_LABELS.other;
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pl.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{pl.label}</p>
                        <p className="text-[12px] text-[var(--text-muted)] truncate">{c.ical_url}</p>
                        {c.last_synced_at && (
                          <p className="text-[12px] text-[var(--color-teal)]">
                            Last synced {new Date(c.last_synced_at).toLocaleString("en-KE", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                      <button onClick={() => handleRemove(c.id)}
                        className="text-red-500 text-[12px] font-semibold flex-shrink-0">Remove</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add new calendar */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Add a calendar</p>
            <Field label="Platform">
              <select value={platform} onChange={e => setPlatform(e.target.value)} className={inputCls}>
                {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
            <Field label={`iCal URL — ${PLATFORM_LABELS[platform]?.hint}`}>
              <input value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://…" className={inputCls} />
            </Field>
            <button onClick={handleAdd} disabled={addStatus === "loading" || !url}
              className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl text-sm">
              {addStatus === "loading" ? "Connecting…" : `Connect ${PLATFORM_LABELS[platform]?.label}`}
            </button>
            {addStatus === "ok"    && <p className="text-[var(--color-teal)] text-sm text-center">Connected! Syncing now — dates will be blocked within a minute.</p>}
            {addStatus === "error" && <p className="text-red-500 text-sm text-center">Could not fetch that URL. Make sure the calendar is set to public.</p>}
          </div>

          {/* Export URL */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Your StayNaivasha export URL</p>
            <p className="text-sm text-[var(--text-muted)]">
              Paste this into Airbnb and Booking.com as an "external calendar" so they block your StayNaivasha dates automatically.
            </p>
            <div className="bg-[var(--bg-primary)] rounded-xl px-3 py-2.5 flex items-center gap-2">
              <p className="text-[12px] text-[var(--text-muted)] flex-1 truncate font-mono">{exportUrl}</p>
              <button onClick={copyExportUrl}
                className="text-sm font-semibold flex-shrink-0"
                style={{ color: copied ? "#1e4a22" : "var(--color-teal)" }}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </>
      )}
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

// ── More menu (Calendar · iCal · Claims · New listing) ───────────────────────

function MoreMenu() {
  const navigate = useNavigate();
  const items = [
    { to: "/owner/calendar",    Icon: CalendarDays, label: "Availability calendar", desc: "Block or open dates on your property" },
    { to: "/owner/ical",        Icon: Link2,        label: "iCal sync",             desc: "Connect Airbnb / Booking.com calendar" },
    { to: "/owner/claims",      Icon: AlertCircle,  label: "Damage claims",         desc: "File or track a damage claim" },
    { to: "/owner/listing/new", Icon: Building2,    label: "Add new listing",       desc: "List another property on StayNaivasha" },
    { to: "/",                  Icon: ExternalLink, label: "Browse as guest",       desc: "Switch to the guest-facing portal" },
  ];
  return (
    <div>
      <h1 className="font-semibold text-[var(--text-primary)] mb-4">More</h1>
      <div className="space-y-2">
        {items.map(({ to, Icon, label, desc }) => (
          <button key={to} type="button" onClick={() => navigate(to)}
            className="w-full flex items-center gap-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-4 py-4 text-left active:scale-[.98] transition-transform">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(30,74,34,0.08)" }}>
              <Icon className="w-5 h-5 text-[var(--color-forest)]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Bottom nav tabs ───────────────────────────────────────────────────────────

const OWNER_TABS = [
  { to: "/owner",          label: "Home",     Icon: HomeIcon,     end: true  },
  { to: "/owner/listings", label: "Listings", Icon: Building2,    end: false },
  { to: "/owner/bookings", label: "Bookings", Icon: CalendarDays, end: false },
  { to: "/owner/earnings", label: "Earnings", Icon: TrendingUp,   end: false },
  { to: "/owner/more",     label: "More",     Icon: LayoutGrid,   end: false },
] as const;

// ── Layout ────────────────────────────────────────────────────────────────────

export default function OwnerLayout() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-20 pb-20">

      {/* ── Host top bar ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center px-4 border-b border-[var(--border)]"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
      >
        <div className="flex items-center gap-2 mr-auto">
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1e4a22 0%, #2a6030 60%, #b8722a 100%)", boxShadow: "0 2px 8px rgba(30,74,34,0.30)" }}
          >SN</span>
          <span className="font-display italic text-[var(--color-forest)] leading-none" style={{ fontSize: "1.15rem" }}>
            StayNaivasha
          </span>
          <span className="ml-1 text-[13px] font-bold text-[var(--color-teal)] bg-[var(--color-teal)]/10 px-2 py-0.5 rounded-full">
            Host
          </span>
        </div>
        <NavLink to="/" className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <ExternalLink className="w-3.5 h-3.5" /> Guest view
        </NavLink>
      </header>

      {/* ── Page content ── */}
      <div className="px-4 py-5 max-w-lg mx-auto">
        <Routes>
          <Route path="/"                     element={<Dashboard />} />
          <Route path="/listings"             element={<MyListings />} />
          <Route path="/listing/new"          element={<NewListing />} />
          <Route path="/listing/edit/:propId" element={<EditListing />} />
          <Route path="/bookings"             element={<OwnerBookings />} />
          <Route path="/earnings"             element={<Earnings />} />
          <Route path="/calendar"             element={<OwnerCalendar />} />
          <Route path="/ical"                 element={<ICalSync />} />
          <Route path="/claims"              element={<DamageClaims />} />
          <Route path="/more"                 element={<MoreMenu />} />
        </Routes>
      </div>

      {/* ── Host bottom nav ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch border-t border-[var(--border)]"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {OWNER_TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                isActive ? "text-[var(--color-forest)]" : "text-[var(--text-muted)]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-8 rounded-full"
                    style={{ background: "rgba(30,74,34,0.08)" }} aria-hidden="true" />
                )}
                <Icon className="w-6 h-6 relative z-10" />
                <span className={`text-[13px] leading-none relative z-10 ${isActive ? "font-bold" : "font-medium"}`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
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
