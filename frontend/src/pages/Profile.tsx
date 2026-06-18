import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { CalendarDays, Heart, MessageCircle, Eye, EyeOff, Mail, Bell, BellOff, Phone } from "lucide-react";

interface Me {
  user_id:    string;
  role:       string;
  phone?:     string;
  name?:      string;
  email?:     string;
  sms_opt_in: boolean;
}

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
  me: Me; onClose: () => void; onSaved: () => void;
}) {
  const [name,      setName]      = useState(me.name ?? "");
  const [phone,     setPhone]     = useState(me.phone ?? "");
  const [smsOptIn,  setSmsOptIn]  = useState(me.sms_opt_in ?? true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  async function save() {
    setSaving(true); setError("");
    const r = await fetch("/api/auth/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name:       name.trim() || null,
        phone:      phone.trim() || null,
        sms_opt_in: smsOptIn,
      }),
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
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Your name" autoFocus
            className="w-full bg-[var(--bg-primary)] border-2 border-[var(--border)] focus:border-[var(--color-teal)] rounded-2xl px-4 py-3 text-[var(--text-primary)] outline-none transition-colors"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block">Phone number</label>
          <div className="flex items-center bg-[var(--bg-primary)] border-2 border-[var(--border)] focus-within:border-[var(--color-teal)] rounded-2xl px-4 overflow-hidden transition-colors">
            <span className="text-lg mr-2 flex-shrink-0" role="img" aria-label="Kenya">🇰🇪</span>
            <input
              type="tel" value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+254 712 345 678"
              className="flex-1 bg-transparent text-[var(--text-primary)] py-3 outline-none text-base"
            />
          </div>
          <p className="text-[11px] text-[var(--text-muted)] px-1">Used for booking confirmations and check-in codes via SMS/WhatsApp</p>
        </div>

        <div className="flex items-center justify-between bg-[var(--bg-primary)] rounded-2xl px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${smsOptIn ? "bg-[var(--color-forest)]/10" : "bg-[var(--border)]"}`}>
              {smsOptIn
                ? <Bell className="w-4 h-4 text-[var(--color-forest)]" />
                : <BellOff className="w-4 h-4 text-[var(--text-muted)]" />
              }
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">SMS notifications</p>
              <p className="text-[11px] text-[var(--text-muted)]">Booking updates, check-in codes</p>
            </div>
          </div>
          <button type="button" role="switch" aria-checked={smsOptIn} onClick={() => setSmsOptIn(v => !v)}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${smsOptIn ? "bg-[var(--color-forest)]" : "bg-[var(--border)]"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${smsOptIn ? "translate-x-6" : "translate-x-0"}`} />
          </button>
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

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}

const inputCls = "w-full bg-[var(--bg-surface)] border-2 border-[var(--border)] focus:border-[var(--color-teal)] rounded-2xl px-4 py-3.5 text-[var(--text-primary)] outline-none transition-colors text-base";

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-[var(--border)]" />
      <span className="text-xs text-[var(--text-muted)] font-medium flex-shrink-0">{label}</span>
      <div className="flex-1 h-px bg-[var(--border)]" />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Profile() {
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const [sp]     = useSearchParams();
  const redirect = sp.get("redirect");
  const googleError = sp.get("error");

  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: fetchMe, retry: false });

  // Phone OTP state
  const [phone,   setPhone]   = useState("");
  const [otp,     setOtp]     = useState("");
  const [otpStep, setOtpStep] = useState<"phone" | "otp">("phone");

  // Email state
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [emailMode,  setEmailMode]  = useState<"login" | "register">("login");
  const [regName,    setRegName]    = useState("");

  // Forgot password
  const [forgotMode, setForgotMode]   = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotDone, setForgotDone]   = useState(false);

  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState("");
  const [editingProfile, setEditingProfile] = useState(false);

  function clearError() { setError(""); }

  // ── Phone OTP ──────────────────────────────────────────────────────────────
  async function requestOTP() {
    if (!phone) return;
    setSending(true); clearError();
    const res = await fetch("/api/auth/otp/request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setSending(false);
    if (res.ok) setOtpStep("otp");
    else setError("Could not send code — check your number and try again");
  }

  async function verifyOTP() {
    if (otp.length < 6) return;
    setSending(true); clearError();
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone, code: otp }),
    });
    setSending(false);
    if (res.ok) {
      const data = await res.json();
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate(redirect ?? (data.role === "owner" || data.role === "admin" ? "/owner" : "/"));
    } else {
      setOtp(""); setError("Incorrect code — check your SMS and try again");
    }
  }

  // ── Email auth ─────────────────────────────────────────────────────────────
  async function handleEmailSubmit() {
    if (!email || !password) return;
    setSending(true); clearError();

    const url  = emailMode === "login" ? "/api/auth/email/login" : "/api/auth/email/register";
    const body = emailMode === "login"
      ? { email, password }
      : { email, password, name: regName || undefined };

    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    setSending(false);

    if (res.ok) {
      const data = await res.json();
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate(redirect ?? (data.role === "owner" || data.role === "admin" ? "/owner" : "/"));
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail ?? (emailMode === "login" ? "Invalid email or password" : "Could not create account"));
    }
  }

  // ── Forgot password ────────────────────────────────────────────────────────
  async function handleForgot() {
    if (!forgotEmail) return;
    setSending(true); clearError();
    await fetch("/api/auth/password/forgot", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail }),
    });
    setSending(false);
    setForgotDone(true);
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
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

  // ── Logged-in profile ──────────────────────────────────────────────────────
  const chevron = (
    <svg viewBox="0 0 24 24" className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );

  if (me) return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-20 pb-6">

      <div className="relative overflow-hidden"
        style={{ background: "linear-gradient(155deg, #0d2e10 0%, #1a4a1e 35%, #5c3010 70%, #2e1506 100%)", minHeight: 220 }}>

        <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full" style={{ background: "rgba(62,200,144,0.07)" }} />
        <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full" style={{ background: "rgba(212,137,42,0.06)" }} />

        <button onClick={() => setEditingProfile(true)} aria-label="Edit profile"
          className="absolute top-12 right-5 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform z-10">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>

        <div className="relative z-10 flex flex-col items-center pt-20 pb-8 px-5 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl mb-4"
            style={{ background: "linear-gradient(135deg, #3ec890 0%, #2ab8a0 100%)" }}>
            {(me.name ?? me.email ?? me.role)[0].toUpperCase()}
          </div>
          <h1 className="font-display italic text-white text-2xl leading-tight">
            {me.name ?? (me.role === "owner" ? "Property Owner" : "Guest")}
          </h1>
          <p className="text-white/50 text-sm mt-1">{me.phone ?? me.email}</p>
          <span className={`mt-2 text-[13px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
            me.role === "owner" ? "bg-[var(--color-mint)]/20 text-[var(--color-mint)]"
            : me.role === "admin" ? "bg-amber-400/20 text-amber-300"
            : "bg-white/10 text-white/50"
          }`}>
            {me.role}
          </span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">

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

        <div className="bg-[var(--bg-surface)] rounded-3xl overflow-hidden border border-[var(--border)]">
          <button onClick={() => setEditingProfile(true)}
            className="w-full flex items-center gap-4 px-4 py-4 active:bg-[var(--bg-primary)] transition-colors text-left">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${me.phone ? "bg-[var(--color-forest)]/10" : "bg-amber-50 dark:bg-amber-900/20"}`}>
              <Phone className={`w-5 h-5 ${me.phone ? "text-[var(--color-forest)]" : "text-amber-500"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--text-primary)] text-sm">
                {me.phone ? "Phone & notifications" : "Add phone number"}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                {me.phone
                  ? `${me.phone} · SMS ${me.sms_opt_in ? "on" : "off"}`
                  : "Required for booking confirmations"}
              </p>
            </div>
            {!me.phone && (
              <span className="flex-shrink-0 text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                Missing
              </span>
            )}
            {me.phone && chevron}
          </button>
        </div>

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

        <button onClick={logout}
          className="w-full flex items-center justify-center gap-2 border border-red-200 dark:border-red-900/40 text-red-500 text-sm font-semibold py-4 rounded-2xl active:scale-[.98] transition-all">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Log out
        </button>

        <p className="text-center text-[13px] text-[var(--text-muted)] pb-2">
          StayNaivasha v1.0 · Built by{" "}
          <a href="https://avinayasolutions.com" target="_blank" rel="noopener noreferrer" className="underline">Avinaya Solutions</a>
        </p>
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

  // ── Login screen — everything visible at once ──────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-20 pb-10">

      {/* Compact brand header */}
      <div className="relative overflow-hidden flex flex-col items-center justify-center py-10 px-6 text-center"
        style={{ background: "linear-gradient(160deg, #1e4a22 0%, #2a5c28 40%, #6b3a10 78%, #3d2008 100%)" }}>
        <div className="absolute inset-0 opacity-25"
          style={{ backgroundImage: "radial-gradient(1px 1px at 20% 30%, white, transparent), radial-gradient(1px 1px at 75% 20%, white, transparent), radial-gradient(1.5px 1.5px at 50% 60%, white, transparent)" }} />
        <h1 className="font-display italic text-white relative z-10" style={{ fontSize: "clamp(1.8rem, 8vw, 2.6rem)" }}>
          Welcome back.
        </h1>
        <p className="text-white/50 text-sm mt-1.5 relative z-10">Sign in to StayNaivasha</p>
      </div>

      <div className="px-5 pt-6 max-w-sm mx-auto space-y-5">

        {/* Google error */}
        {googleError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <p className="text-red-600 text-sm font-medium">Google sign-in failed — please try another method</p>
          </div>
        )}

        {/* ── Google button ── */}
        <a href="/api/auth/google"
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[var(--border)] text-gray-700 font-semibold py-4 rounded-2xl text-sm shadow-sm active:scale-[.98] transition-all">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </a>

        <Divider label="or use your phone" />

        {/* ── Phone OTP ── */}
        {otpStep === "phone" ? (
          <div className="space-y-3">
            <div className="flex items-center bg-[var(--bg-surface)] border-2 border-[var(--border)] rounded-2xl px-4 overflow-hidden focus-within:border-[var(--color-teal)] transition-colors">
              <span className="text-lg leading-none mr-2 flex-shrink-0" role="img" aria-label="Kenya">🇰🇪</span>
              <input
                type="tel" value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === "Enter" && requestOTP()}
                placeholder="+254 712 345 678"
                className="flex-1 bg-transparent text-[var(--text-primary)] py-3.5 outline-none text-base"
              />
              <button onClick={requestOTP} disabled={sending || !phone}
                className="flex-shrink-0 bg-[var(--color-forest)] disabled:bg-gray-300 text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-all ml-2">
                {sending ? <Spinner /> : "Send code"}
              </button>
            </div>
            {error && otpStep === "phone" && (
              <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}
            <p className="text-xs text-[var(--text-muted)] text-center">
              We'll SMS you a 6-digit code — no password needed
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Code sent to <strong className="text-[var(--text-primary)]">{phone}</strong></p>
            </div>
            <div onClick={() => document.getElementById("otp-input")?.focus()} className="cursor-text">
              <OTPInput value={otp} onChange={setOtp} />
            </div>
            {error && <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            <button onClick={verifyOTP} disabled={sending || otp.length < 6}
              className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-sm active:scale-[.98] transition-all">
              {sending ? <span className="flex items-center justify-center gap-2"><Spinner /> Verifying…</span> : "Verify & sign in"}
            </button>
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <button onClick={() => { setOtpStep("phone"); setOtp(""); clearError(); }} className="underline">Change number</button>
              <button onClick={requestOTP} className="underline">Resend code</button>
            </div>
          </div>
        )}

        <Divider label="or use email" />

        {/* ── Email / Password ── */}
        {!forgotMode ? (
          <div className="space-y-3">
            {emailMode === "register" && (
              <input value={regName} onChange={e => setRegName(e.target.value)}
                placeholder="Your name (optional)"
                className={inputCls} />
            )}

            <div className="flex items-center bg-[var(--bg-surface)] border-2 border-[var(--border)] rounded-2xl px-4 overflow-hidden focus-within:border-[var(--color-teal)] transition-colors">
              <Mail size={16} className="text-[var(--text-muted)] mr-2 flex-shrink-0" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 bg-transparent text-[var(--text-primary)] py-3.5 outline-none text-base" />
            </div>

            <div className="relative">
              <input type={showPw ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleEmailSubmit()}
                placeholder={emailMode === "register" ? "Choose a password (8+ characters)" : "Password"}
                className={`${inputCls} pr-12`} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            <button onClick={handleEmailSubmit} disabled={sending || !email || !password}
              className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-sm active:scale-[.98] transition-all">
              {sending
                ? <span className="flex items-center justify-center gap-2"><Spinner /> {emailMode === "login" ? "Signing in…" : "Creating account…"}</span>
                : emailMode === "login" ? "Sign in with email" : "Create account"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button type="button"
                onClick={() => { setEmailMode(m => m === "login" ? "register" : "login"); clearError(); }}
                className="text-[var(--color-teal)] font-medium">
                {emailMode === "login" ? "Create an account" : "Sign in instead"}
              </button>
              {emailMode === "login" && (
                <button type="button"
                  onClick={() => { setForgotMode(true); setForgotEmail(email); clearError(); }}
                  className="text-[var(--text-muted)] underline">
                  Forgot password?
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ── Forgot password ── */
          <div className="space-y-3">
            <button type="button" onClick={() => { setForgotMode(false); setForgotDone(false); clearError(); }}
              className="text-sm text-[var(--text-muted)] flex items-center gap-1">
              ‹ Back
            </button>

            {forgotDone ? (
              <div className="bg-[var(--color-forest)]/8 border border-[var(--color-forest)]/20 rounded-2xl px-5 py-5 text-center space-y-2">
                <Mail size={28} className="text-[var(--color-forest)] mx-auto" />
                <p className="font-semibold text-[var(--text-primary)]">Check your email</p>
                <p className="text-sm text-[var(--text-muted)]">
                  If <strong>{forgotEmail}</strong> is registered, a reset link has been sent. Check your spam folder too.
                </p>
                <p className="text-xs text-[var(--text-muted)]">Link expires in 30 minutes.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-[var(--text-muted)]">Enter your email and we'll send a reset link.</p>
                <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleForgot()}
                  placeholder="your@email.com" autoFocus className={inputCls} />
                {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
                <button onClick={handleForgot} disabled={sending || !forgotEmail}
                  className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-sm active:scale-[.98] transition-all">
                  {sending ? <span className="flex items-center justify-center gap-2"><Spinner /> Sending…</span> : "Send reset link"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Owner note */}
        {!forgotMode && (
          <div className="flex items-start gap-3 bg-[var(--bg-surface)] rounded-2xl px-4 py-3 border border-[var(--border)]">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--color-forest)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
              <path d="M9 21V12h6v9" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Property owner?</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Use the same sign-in above. After signing in you'll land straight on your owner dashboard to manage listings, photos &amp; bookings.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
