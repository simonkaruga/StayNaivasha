import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { CalendarDays, Heart, MessageCircle } from "lucide-react";

interface Me { user_id: string; role: string; phone?: string; name?: string; }

async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) throw new Error("Not logged in");
  return res.json();
}

// ── Digit-by-digit OTP input ──────────────────────────────────────────────────
function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i}
          className={`w-11 h-14 rounded-xl border-2 flex items-center justify-center transition-colors ${
            i < value.length
              ? "border-[var(--color-forest)] bg-[var(--color-forest)]/8"
              : i === value.length
              ? "border-[var(--color-teal)]"
              : "border-[var(--border)] bg-[var(--bg-surface)]"
          }`}>
          <span className="font-mono font-bold text-xl text-[var(--text-primary)]">
            {value[i] ?? ""}
          </span>
        </div>
      ))}
      {/* Hidden real input handles actual typing */}
      <input
        type="text" inputMode="numeric" maxLength={6}
        value={value} onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        id="otp-input" autoFocus
      />
    </div>
  );
}

// ── Profile edit sheet ────────────────────────────────────────────────────────
function ProfileEditSheet({ me, onClose, onSaved }: {
  me: Me;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,   setName]   = useState(me.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function save() {
    setSaving(true); setError("");
    const r = await fetch("/api/auth/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: name.trim() || null }),
    });
    setSaving(false);
    if (r.ok) { onSaved(); onClose(); }
    else setError("Could not save — try again");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-surface)] rounded-t-3xl px-5 pt-4 pb-10 space-y-4"
        style={{ animation: "fade-up 0.2s ease-out both" }}>
        <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto" />
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-primary)]">Edit profile</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-muted)]">✕</button>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block">Display name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && save()}
            placeholder="Your name"
            autoFocus
            className="w-full bg-[var(--bg-primary)] border-2 border-[var(--border)] focus:border-[var(--color-teal)] rounded-2xl px-4 py-3 text-[var(--text-primary)] outline-none transition-colors"
          />
        </div>
        {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        <button onClick={save} disabled={saving}
          className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-sm">
          {saving
            ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</span>
            : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Profile() {
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const [sp]     = useSearchParams();
  const redirect = sp.get("redirect");

  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: fetchMe, retry: false });

  const [phone,         setPhone]         = useState("");
  const [otp,           setOtp]           = useState("");
  const [step,          setStep]          = useState<"phone" | "otp">("phone");
  const [sending,       setSending]       = useState(false);
  const [error,         setError]         = useState("");
  const [editingProfile, setEditingProfile] = useState(false);

  async function requestOTP() {
    if (!phone) return;
    setSending(true); setError("");
    const res = await fetch("/api/auth/otp/request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setSending(false);
    if (res.ok) setStep("otp");
    else setError("Could not send code — check your number and try again");
  }

  async function verifyOTP() {
    if (otp.length < 6) return;
    setSending(true); setError("");
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone, code: otp }),
    });
    setSending(false);
    if (res.ok) {
      await qc.invalidateQueries({ queryKey: ["me"] });
      if (redirect) navigate(redirect);
    } else {
      setOtp("");
      setError("Incorrect code — check your SMS and try again");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    qc.clear();
    navigate("/profile", { replace: true });
  }

  if (isLoading) return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-[var(--color-mint)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Logged in ──────────────────────────────────────────────────────────────
  const chevron = (
    <svg viewBox="0 0 24 24" className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );

  if (me) return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-14 pb-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden"
        style={{ background: "linear-gradient(155deg, #0d2e10 0%, #1a4a1e 35%, #5c3010 70%, #2e1506 100%)", minHeight: 220 }}>

        {/* decorative circles */}
        <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full" style={{ background: "rgba(62,200,144,0.07)" }} />
        <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full" style={{ background: "rgba(212,137,42,0.06)" }} />

        {/* edit button */}
        <button onClick={() => setEditingProfile(true)}
          aria-label="Edit profile"
          className="absolute top-12 right-5 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform z-10">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>

        <div className="relative z-10 flex flex-col items-center pt-14 pb-8 px-5 text-center">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl mb-4"
            style={{ background: "linear-gradient(135deg, #3ec890 0%, #2ab8a0 100%)" }}>
            {(me.name ?? me.role)[0].toUpperCase()}
          </div>

          <h1 className="font-display italic text-white text-2xl leading-tight">
            {me.name ?? (me.role === "owner" ? "Property Owner" : "Guest")}
          </h1>
          <p className="text-white/50 text-sm mt-1">{me.phone}</p>

          <span className={`mt-2 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
            me.role === "owner" ? "bg-[var(--color-mint)]/20 text-[var(--color-mint)]"
            : me.role === "admin" ? "bg-amber-400/20 text-amber-300"
            : "bg-white/10 text-white/50"
          }`}>
            {me.role}
          </span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* Owner dashboard CTA */}
        {me.role === "owner" && (
          <Link to="/owner"
            className="flex items-center justify-between text-white px-5 py-4 rounded-2xl active:scale-[.98] transition-transform"
            style={{ background: "linear-gradient(135deg, #1e4a22 0%, #2a6030 60%, #3a2010 100%)", boxShadow: "0 4px 20px rgba(30,74,34,0.4)" }}>
            <div>
              <p className="font-bold text-sm">Owner Dashboard</p>
              <p className="text-xs text-white/55 mt-0.5">Manage listings, bookings & payouts</p>
            </div>
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--color-mint)]" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* Main menu card */}
        <div className="bg-[var(--bg-surface)] rounded-3xl overflow-hidden border border-[var(--border)]">
          <Link to="/bookings" className="flex items-center gap-4 px-4 py-4 active:bg-[var(--bg-primary)] transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-forest)]/10 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-5 h-5 text-[var(--color-forest)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--text-primary)] text-sm">My bookings</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">View and manage your stays</p>
            </div>
            {chevron}
          </Link>

          <div className="h-px bg-[var(--border)] mx-4" />

          <Link to="/saved" className="flex items-center gap-4 px-4 py-4 active:bg-[var(--bg-primary)] transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--text-primary)] text-sm">Saved homes</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Properties you've wishlisted</p>
            </div>
            {chevron}
          </Link>
        </div>

        {/* Support & info card */}
        <div className="bg-[var(--bg-surface)] rounded-3xl overflow-hidden border border-[var(--border)]">
          <a href="https://wa.me/254700000000" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-4 px-4 py-4 active:bg-[var(--bg-primary)] transition-colors">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#e9fef0" }}>
              <MessageCircle className="w-5 h-5" style={{ color: "#25D366" }} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[var(--text-primary)] text-sm">Help & support</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">WhatsApp us — we reply fast</p>
            </div>
            {chevron}
          </a>

          <div className="h-px bg-[var(--border)] mx-4" />

          <Link to="/about" className="flex items-center gap-4 px-4 py-4 active:bg-[var(--bg-primary)] transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[var(--text-primary)] text-sm">About StayNaivasha</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">How it works · Legal</p>
            </div>
            {chevron}
          </Link>
        </div>

        {/* Log out */}
        <button onClick={logout}
          className="w-full flex items-center justify-center gap-2 border border-red-200 dark:border-red-900/40 text-red-500 text-sm font-semibold py-4 rounded-2xl active:scale-[.98] transition-all">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Log out
        </button>

        <p className="text-center text-[10px] text-[var(--text-muted)] pb-2">StayNaivasha v1.0 · Built by <a href="https://avinayasolutions.com" target="_blank" rel="noopener noreferrer" className="underline">Avinaya Solutions</a></p>
      </div>

      {editingProfile && (
        <ProfileEditSheet
          me={me}
          onClose={() => setEditingProfile(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["me"] })}
        />
      )}
    </div>
  );

  // ── Login ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">

      {/* Brand top */}
      <div className="relative overflow-hidden flex flex-col items-center justify-center pt-16 pb-12 px-6 text-center flex-shrink-0"
        style={{ background: "linear-gradient(160deg, #1e4a22 0%, #2a5c28 40%, #6b3a10 78%, #3d2008 100%)" }}>
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "radial-gradient(1px 1px at 20% 20%, white, transparent), radial-gradient(1px 1px at 70% 15%, white, transparent), radial-gradient(1.5px 1.5px at 45% 35%, white, transparent), radial-gradient(1px 1px at 80% 40%, white, transparent)" }} />
        <p className="text-[var(--color-mint)] text-[10px] font-semibold tracking-[0.3em] uppercase mb-3 relative z-10">
          Naivasha · Kenya
        </p>
        <h1 className="font-display italic text-white relative z-10" style={{ fontSize: "clamp(2rem, 9vw, 3rem)" }}>
          Welcome back.
        </h1>
        <p className="text-white/50 text-sm mt-2 relative z-10">Sign in with your Kenyan phone number</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 bg-[var(--bg-primary)] rounded-t-3xl -mt-4 px-6 pt-8 pb-8">
        {step === "phone" ? (
          <div className="space-y-4 max-w-sm mx-auto">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-2">
                Phone number
              </label>
              <div className="flex items-center bg-[var(--bg-surface)] border-2 border-[var(--border)] rounded-2xl px-4 overflow-hidden focus-within:border-[var(--color-teal)] transition-colors">
                <span className="text-lg mr-2 flex-shrink-0">🇰🇪</span>
                <input
                  type="tel" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && requestOTP()}
                  placeholder="+254712345678"
                  className="flex-1 bg-transparent text-[var(--text-primary)] py-4 outline-none text-base"
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}
            <button onClick={requestOTP} disabled={sending || !phone}
              className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-bold py-4 rounded-2xl text-sm active:scale-[.98] transition-all">
              {sending
                ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</span>
                : "Send OTP code"}
            </button>
            <p className="text-xs text-center text-[var(--text-muted)]">
              We'll send a 6-digit code via SMS. Standard rates apply.
            </p>
          </div>
        ) : (
          <div className="space-y-5 max-w-sm mx-auto">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Code sent to</p>
              <p className="font-bold text-[var(--text-primary)]">{phone}</p>
            </div>
            {/* Tap anywhere to focus the hidden input */}
            <div onClick={() => document.getElementById("otp-input")?.focus()} className="cursor-text">
              <OTPInput value={otp} onChange={setOtp} />
            </div>
            {error && <p className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}
            <button onClick={verifyOTP} disabled={sending || otp.length < 6}
              className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-bold py-4 rounded-2xl text-sm active:scale-[.98] transition-all">
              {sending
                ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verifying…</span>
                : "Verify & sign in"}
            </button>
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <button onClick={() => { setStep("phone"); setOtp(""); setError(""); }} className="underline">
                Change number
              </button>
              <button onClick={requestOTP} className="underline">
                Resend code
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
