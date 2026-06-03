import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Routes, Route, NavLink } from "react-router-dom";

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api${path}`, { credentials: "include", ...opts });

// ── Stats ─────────────────────────────────────────────────────────────────────

function Stats() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await api("/admin/stats");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="font-semibold text-[var(--text-primary)]">Platform overview</h1>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total listings",    value: data?.listings?.total ?? 0 },
          { label: "Active listings",   value: data?.listings?.active ?? 0 },
          { label: "Total bookings",    value: data?.bookings?.total ?? 0 },
          { label: "Confirmed",         value: data?.bookings?.confirmed ?? 0 },
          { label: "Revenue (KES)",     value: (data?.revenue_kes ?? 0).toLocaleString(), wide: true },
        ].map(({ label, value, wide }) => (
          <div key={label} className={`bg-[var(--bg-surface)] rounded-2xl p-4 ${wide ? "col-span-2" : ""}`}>
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pending listings ──────────────────────────────────────────────────────────

function PendingListings() {
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState<string | null>(null);

  const { data: listings, isLoading } = useQuery({
    queryKey: ["pending-listings"],
    queryFn: async () => {
      const res = await api("/admin/pending-listings");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  async function approve(id: string, tier: number) {
    setApproving(id);
    await api(`/admin/listings/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    queryClient.invalidateQueries({ queryKey: ["pending-listings"] });
    setApproving(null);
  }

  async function suspend(id: string) {
    const reason = prompt("Reason for suspension:");
    if (!reason) return;
    await api(`/admin/listings/${id}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    queryClient.invalidateQueries({ queryKey: ["pending-listings"] });
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="font-semibold text-[var(--text-primary)]">
        Pending listings
        {listings?.length > 0 && (
          <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{listings.length}</span>
        )}
      </h1>

      {listings?.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="text-3xl mb-2">✓</p>
          <p className="text-sm">All listings reviewed</p>
        </div>
      )}

      <div className="space-y-3">
        {listings?.map((p: any) => (
          <div key={p.id} className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
            <div>
              <p className="font-medium text-[var(--text-primary)]">{p.title}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 capitalize">
                {p.type} · KES {p.price_per_night?.toLocaleString()}/night
              </p>
              {p.landmark_instructions && (
                <p className="text-xs text-[var(--text-muted)] mt-1">{p.landmark_instructions}</p>
              )}
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map(tier => (
                <button key={tier}
                  onClick={() => approve(p.id, tier)}
                  disabled={approving === p.id}
                  className="flex-1 bg-[var(--color-forest)] text-white text-xs font-medium py-2 rounded-xl disabled:opacity-50">
                  Approve T{tier}
                </button>
              ))}
              <button onClick={() => suspend(p.id)}
                className="flex-1 bg-red-500 text-white text-xs font-medium py-2 rounded-xl">
                Suspend
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Disputes ─────────────────────────────────────────────────────────────────

function Disputes() {
  const queryClient = useQueryClient();
  const [ruling, setRuling] = useState<Record<string, { ruling: string; amount: string }>>({});

  const { data: claims, isLoading } = useQuery({
    queryKey: ["disputes"],
    queryFn: async () => {
      const res = await api("/admin/disputes");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  async function submitRuling(claimId: string) {
    const r = ruling[claimId];
    if (!r?.ruling) return;
    await api("/admin/disputes/ruling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim_id: claimId, ruling: r.ruling, approved_amount: parseInt(r.amount ?? "0") }),
    });
    queryClient.invalidateQueries({ queryKey: ["disputes"] });
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="font-semibold text-[var(--text-primary)]">Dispute claims</h1>

      {claims?.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="text-3xl mb-2">✓</p>
          <p className="text-sm">No pending disputes</p>
        </div>
      )}

      <div className="space-y-4">
        {claims?.map((c: any) => (
          <div key={c.id} className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Booking: <span className="font-mono">{c.booking_id?.slice(0, 8)}</span></p>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-1">Claimed: KES {c.claimed_amount?.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <input
                value={ruling[c.id]?.ruling ?? ""}
                onChange={e => setRuling(r => ({ ...r, [c.id]: { ...r[c.id], ruling: e.target.value } }))}
                placeholder="Ruling notes"
                className={inputCls} />
              <input
                type="number"
                value={ruling[c.id]?.amount ?? ""}
                onChange={e => setRuling(r => ({ ...r, [c.id]: { ...r[c.id], amount: e.target.value } }))}
                placeholder="Approved amount (KES, 0 = reject)"
                className={inputCls} />
              <button onClick={() => submitRuling(c.id)} disabled={!ruling[c.id]?.ruling}
                className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl text-sm">
                Submit ruling
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Owner verification ────────────────────────────────────────────────────────

function OwnerVerification() {
  const queryClient = useQueryClient();

  const { data: owners, isLoading } = useQuery({
    queryKey: ["admin-owners"],
    queryFn: async () => {
      const res = await api("/admin/owners");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  async function toggleVerify(userId: string, verified: boolean) {
    await api("/admin/owners/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, verified }),
    });
    queryClient.invalidateQueries({ queryKey: ["admin-owners"] });
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="font-semibold text-[var(--text-primary)]">Owner verification</h1>

      {owners?.length === 0 && (
        <p className="text-center text-[var(--text-muted)] text-sm py-8">No owners registered yet.</p>
      )}

      <div className="space-y-3">
        {owners?.map((u: any) => (
          <div key={u.id} className="bg-[var(--bg-surface)] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{u.name ?? "Unnamed"}</p>
              <p className="text-xs text-[var(--text-muted)]">{u.phone}</p>
              {u.verified_at && (
                <p className="text-xs text-[var(--color-teal)] mt-0.5">✓ Verified {new Date(u.verified_at).toLocaleDateString()}</p>
              )}
            </div>
            <button
              onClick={() => toggleVerify(u.id, !u.verified_at)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${
                u.verified_at ? "bg-red-100 text-red-600" : "bg-[var(--color-forest)] text-white"
              }`}>
              {u.verified_at ? "Revoke" : "Verify"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Blacklist ─────────────────────────────────────────────────────────────────

function Blacklist() {
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function handleBlacklist() {
    if (!userId || !reason) return;
    setStatus("loading");
    const res = await api("/admin/guests/blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, reason }),
    });
    setStatus(res.ok ? "ok" : "error");
    if (res.ok) { setUserId(""); setReason(""); }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-semibold text-[var(--text-primary)]">Blacklist guest</h1>
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-[var(--text-muted)]">User ID</label>
          <input value={userId} onChange={e => setUserId(e.target.value)}
            placeholder="User UUID" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[var(--text-muted)]">Reason</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. Property damage — KES 15,000 claim filed"
            rows={3} className={`${inputCls} resize-none`} />
        </div>
        <button onClick={handleBlacklist} disabled={status === "loading" || !userId || !reason}
          className="w-full bg-red-500 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl text-sm">
          {status === "loading" ? "Blacklisting…" : "Blacklist guest"}
        </button>
        {status === "ok" && <p className="text-[var(--color-teal)] text-sm text-center">✓ Guest blacklisted</p>}
        {status === "error" && <p className="text-red-500 text-sm text-center">Failed — check user ID</p>}
      </div>
    </div>
  );
}

// ── Admin nav + layout ────────────────────────────────────────────────────────

const adminTabs = [
  { to: "/admin", label: "Stats", end: true },
  { to: "/admin/listings", label: "Listings" },
  { to: "/admin/owners", label: "Owners" },
  { to: "/admin/disputes", label: "Disputes" },
  { to: "/admin/blacklist", label: "Blacklist" },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="sticky top-0 z-40 bg-[var(--color-nearblack)] px-4 py-3 flex items-center justify-between">
        <p className="font-display italic text-lg text-[var(--color-mint)]">Admin</p>
        <div className="flex gap-4">
          {adminTabs.map(t => (
            <NavLink key={t.to} to={t.to} end={t.end}
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? "text-white" : "text-gray-400"}`}>
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto">
        <Routes>
          <Route path="/" element={<Stats />} />
          <Route path="/listings" element={<PendingListings />} />
          <Route path="/owners" element={<OwnerVerification />} />
          <Route path="/disputes" element={<Disputes />} />
          <Route path="/blacklist" element={<Blacklist />} />
        </Routes>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm outline-none";

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-[var(--color-mint)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
