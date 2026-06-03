import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";

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

  if (isLoading) return <LoadingSpinner />;
  if (error?.message === "unauth") {
    navigate("/profile");
    return null;
  }

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
          <p className="text-3xl">🏡</p>
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
  });
  const [rawDetails, setRawDetails] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      }),
    });
    setSaving(false);
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["owner-dash"] });
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

      {/* AI description writer */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Description
          <span className="ml-2 text-xs text-[var(--color-teal)] font-normal">✨ AI writer</span>
        </p>
        <textarea value={rawDetails} onChange={e => setRawDetails(e.target.value)}
          placeholder="Tell AI what you have: 3 bed, lake view, sleeps 6, wifi, bbq, 2km from Hell's Gate…"
          rows={2} className={`${inputCls} resize-none`} />
        <button type="button" onClick={generateDescription} disabled={aiLoading || !rawDetails}
          className="text-xs text-[var(--color-teal)] font-medium disabled:opacity-40">
          {aiLoading ? "Writing…" : "✨ Generate description"}
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

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <p className="text-xs text-[var(--text-muted)] text-center">
        Your listing goes live after admin review + 8 photos added
      </p>

      <button type="submit" disabled={saving}
        className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-semibold py-3.5 rounded-2xl text-sm">
        {saving ? "Saving…" : "Save listing"}
      </button>
    </form>
  );
}

// ── Owner bookings list ──────────────────────────────────────────────────────

function OwnerBookings() {
  const [props, setProps] = useState<{ id: string; title: string }[]>([]);
  const [selectedProp, setSelectedProp] = useState("");

  useEffect(() => {
    api("/properties?owner=me", {}).then(r => r.ok ? r.json() : []).then((list: any[]) => {
      if (Array.isArray(list)) setProps(list);
    });
  }, []);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["owner-bookings", selectedProp],
    queryFn: async () => {
      const res = await api(`/owner/bookings${selectedProp ? `?property_id=${selectedProp}` : ""}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

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

      {props.length > 0 && (
        <select value={selectedProp} onChange={e => setSelectedProp(e.target.value)} className={inputCls}>
          <option value="">All properties</option>
          {props.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
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
            {b.checkin_code && b.status === "confirmed" && (
              <div className="flex items-center gap-2 bg-[var(--bg-primary)] rounded-xl px-3 py-2">
                <p className="text-xs text-[var(--text-muted)]">Code:</p>
                <p className="font-mono font-bold text-lg text-[var(--color-forest)] tracking-widest">{b.checkin_code}</p>
              </div>
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

function OwnerCalendar() {
  const [propertyId, setPropertyId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth()); // 0-indexed
  const [toggling, setToggling] = useState<string | null>(null);
  const queryClient = useQueryClient();

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

      <Field label="Property ID">
        <input value={propertyId} onChange={e => setPropertyId(e.target.value)}
          placeholder="Paste your property UUID" className={inputCls} />
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
        <Field label="Property ID">
          <input value={propertyId} onChange={e => setPropertyId(e.target.value)}
            placeholder="Paste your property UUID" className={inputCls} />
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

// ── Owner nav ─────────────────────────────────────────────────────────────────

const ownerTabs = [
  { to: "/owner", label: "Home", end: true },
  { to: "/owner/listing/new", label: "New listing" },
  { to: "/owner/bookings", label: "Bookings" },
  { to: "/owner/earnings", label: "Earnings" },
  { to: "/owner/calendar", label: "Calendar" },
  { to: "/owner/ical", label: "iCal sync" },
];

// ── Layout ────────────────────────────────────────────────────────────────────

export default function OwnerLayout() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Top nav */}
      <div className="sticky top-0 z-40 bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <p className="font-display italic text-lg text-[var(--color-forest)]">StayNaivasha</p>
        <div className="flex gap-4">
          {ownerTabs.map(t => (
            <NavLink key={t.to} to={t.to} end={t.end}
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? "text-[var(--color-forest)]" : "text-[var(--text-muted)]"}`}>
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/listing/new" element={<NewListing />} />
          <Route path="/bookings" element={<OwnerBookings />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/calendar" element={<OwnerCalendar />} />
          <Route path="/ical" element={<ICalSync />} />
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
