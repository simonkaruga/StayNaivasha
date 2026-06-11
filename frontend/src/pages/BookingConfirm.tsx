import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { generateBookingPDF } from "../utils/pdf";
import { imgSrc } from "../utils/image";

type Stage = "pending" | "confirmed" | "cancelled" | "timeout";

interface BookingDetail {
  id: string; property_id: string;
  check_in: string; check_out: string;
  total_amount: number; checkin_code: string;
  mpesa_ref: string | null; status: string;
}

interface NavState {
  propertyTitle?: string;
  propertyImage?: string;
  propertyType?:  string;
  checkIn?:  string;
  checkOut?: string;
  nights?:   number;
  total?:    number;
}

export default function BookingConfirm() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate      = useNavigate();
  const location      = useLocation();
  const nav           = (location.state ?? {}) as NavState;

  const [stage,   setStage]   = useState<Stage>("pending");
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [secs,    setSecs]    = useState(600);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopAll() {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  useEffect(() => {
    if (!bookingId) return;
    timerRef.current = setInterval(() => {
      setSecs(s => { if (s <= 1) { stopAll(); setStage("timeout"); return 0; } return s - 1; });
    }, 1000);
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/payments/mpesa/status/${bookingId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "confirmed") {
          stopAll();
          const dr = await fetch(`/api/bookings/${bookingId}`, { credentials: "include" });
          if (dr.ok) setBooking(await dr.json());
          setStage("confirmed");
        } else if (data.status === "cancelled") { stopAll(); setStage("cancelled"); }
      } catch { /* keep polling */ }
    }, 3000);
    return stopAll;
  }, [bookingId]);

  const mins    = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss      = String(secs % 60).padStart(2, "0");
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });

  // ── Confirmed ──────────────────────────────────────────────────────────────
  if (stage === "confirmed" && booking) {
    const nights = Math.max(1,
      (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000
    );

    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] pb-8">

        {/* ── Property photo hero — replaces solid-colour header ── */}
        <div className="relative overflow-hidden" style={{ height: 300 }}>
          {nav.propertyImage
            ? <img src={imgSrc(nav.propertyImage, 800)} alt={nav.propertyTitle ?? "Property"}
                className="w-full h-full object-cover" />
            : <div className="w-full h-full"
                style={{ background: "linear-gradient(160deg, #1e4a22 0%, #2a5c28 40%, #6b3a10 80%, #3d2008 100%)" }} />
          }

          {/* Gradient — top transparent, bottom dark for text */}
          <div className="absolute inset-0" style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.0) 35%, rgba(0,0,0,0.75) 100%)",
          }} />

          {/* Back button */}
          <button onClick={() => navigate("/")}
            className="absolute top-12 left-4 w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Check badge + headline over photo */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 flex items-end gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-mint)] flex items-center justify-center shadow-lg flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-[var(--color-nearblack)]" fill="none" stroke="currentColor" strokeWidth={3}>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-display italic text-3xl text-white leading-tight">You're booked!</p>
              {nav.propertyTitle && (
                <p className="text-white/70 text-sm mt-0.5 truncate">{nav.propertyTitle}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Cards ── */}
        <div className="px-4 -mt-2 space-y-3 pt-4">

          {/* M-Pesa ref row */}
          {booking.mpesa_ref && (
            <div className="flex items-center justify-between bg-[var(--bg-surface)] rounded-2xl px-4 py-3 border border-[var(--border)]">
              <span className="text-xs text-[var(--text-muted)] font-medium">M-Pesa ref</span>
              <span className="font-mono text-sm font-bold text-[var(--text-primary)]">{booking.mpesa_ref}</span>
            </div>
          )}

          {/* Check-in code */}
          <div className="bg-[var(--bg-surface)] rounded-3xl p-5 text-center border border-[var(--border)]">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.22em] font-semibold mb-3">
              Check-in code — show to owner
            </p>
            <div className="flex items-center justify-center gap-2">
              {booking.checkin_code.split("").map((digit, i) => (
                <div key={i} className="w-14 h-16 rounded-2xl border-2 border-[var(--color-forest)] bg-[var(--bg-primary)] flex items-center justify-center">
                  <span className="font-mono font-bold text-3xl text-[var(--color-forest)]">{digit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stay details */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border)]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-center flex-1">
                <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide font-semibold mb-1">Check-in</p>
                <p className="font-bold text-[var(--text-primary)] text-sm">{fmtDate(booking.check_in)}</p>
              </div>
              <div className="px-4 text-center">
                <p className="text-xs font-semibold text-[var(--color-amber)]">{Math.round(nights)} nights</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide font-semibold mb-1">Check-out</p>
                <p className="font-bold text-[var(--text-primary)] text-sm">{fmtDate(booking.check_out)}</p>
              </div>
            </div>
            <div className="h-px bg-[var(--border)]" />
            <div className="flex justify-between items-center mt-3">
              <span className="text-sm text-[var(--text-muted)]">Total paid</span>
              <span className="text-lg font-bold text-[var(--text-primary)]">
                KES {booking.total_amount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Actions */}
          <button onClick={() => generateBookingPDF(booking)}
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl active:scale-[.98]"
            style={{ background: "linear-gradient(135deg, #1e4a22 0%, #2a6838 100%)", boxShadow: "0 4px 14px rgba(30,74,34,0.4)" }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download PDF confirmation
          </button>

          <button
            onClick={() =>
              navigator.share
                ? navigator.share({ title: "I just booked in Naivasha!", url: `https://staynaivasha.co.ke/property/${booking.property_id}` }).catch(() => {})
                : navigator.clipboard.writeText(`https://staynaivasha.co.ke/property/${booking.property_id}`)
            }
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold py-4 rounded-2xl active:scale-[.98]">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.532 5.849L.073 23.927l6.244-1.635A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.645-.52-5.146-1.424l-.369-.219-3.826 1.003 1.02-3.722-.24-.382A9.944 9.944 0 012 12C2 6.478 6.477 2 12 2s10 4.478 10 10-4.477 10-10 10z"/>
            </svg>
            Share on WhatsApp
          </button>

          {/* ── Review nudge ── */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">✍️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">Enjoyed your stay?</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">After check-out, leaving a review helps other guests and supports the host.</p>
              <button
                onClick={() => navigate("/bookings")}
                className="mt-2 text-xs font-bold text-amber-700 underline underline-offset-2">
                Go to My Trips to leave a review →
              </button>
            </div>
          </div>

          <button onClick={() => navigate("/")}
            className="w-full border border-[var(--border)] text-[var(--text-muted)] py-4 rounded-2xl text-sm font-medium">
            Back to home
          </button>
        </div>
      </div>
    );
  }

  // ── Timeout ──────────────────────────────────────────────────────────────────
  if (stage === "timeout") return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 pb-20 text-center space-y-5">
      <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-9 h-9 text-amber-500" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        </svg>
      </div>
      <div>
        <h2 className="font-semibold text-[var(--text-primary)] text-xl mb-2">Session expired</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-xs leading-relaxed">
          The M-Pesa prompt timed out. Your dates have been released.
          You have <strong className="text-[var(--text-primary)]">not</strong> been charged.
        </p>
      </div>
      <button onClick={() => navigate(-1)}
        className="w-full max-w-xs py-4 rounded-2xl font-bold text-white"
        style={{ background: "linear-gradient(135deg, #b8722a, #d4892a)" }}>
        Try again
      </button>
    </div>
  );

  // ── Cancelled ─────────────────────────────────────────────────────────────────
  if (stage === "cancelled") return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 pb-20 text-center space-y-5">
      <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-9 h-9 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      </div>
      <div>
        <h2 className="font-semibold text-[var(--text-primary)] text-xl mb-2">Payment cancelled</h2>
        <p className="text-[var(--text-muted)] text-sm">You have not been charged.</p>
      </div>
      <button onClick={() => navigate(-1)}
        className="w-full max-w-xs py-4 rounded-2xl font-bold text-white"
        style={{ background: "linear-gradient(135deg, #1e4a22, #2a6838)" }}>
        Try again
      </button>
    </div>
  );

  // ── Waiting for PIN ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col pb-20">

      {/* Property photo reminder — tells user what they're paying for */}
      {nav.propertyImage && (
        <div className="relative overflow-hidden flex-shrink-0" style={{ height: 200 }}>
          <img
            src={imgSrc(nav.propertyImage, 800)}
            alt={nav.propertyTitle ?? "Property"}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0" style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.0) 40%, rgba(0,0,0,0.70) 100%)",
          }} />
          {/* Back button */}
          <button onClick={() => { stopAll(); navigate(-1); }}
            className="absolute top-12 left-4 w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          {/* Property info overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
            <p className="text-white font-semibold text-sm leading-snug">{nav.propertyTitle}</p>
            {nav.nights && nav.total && (
              <p className="text-white/65 text-xs mt-0.5">
                {nav.nights} night{nav.nights !== 1 ? "s" : ""} · KES {nav.total.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* M-Pesa wait content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">

        {/* Sonar rings */}
        <div className="relative mb-8 flex items-center justify-center" style={{ width: 160, height: 160 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="absolute rounded-full border-2 border-[#00A651]"
              style={{ inset: 0, opacity: 0, animation: `mpesa-ring 2.1s ease-out ${i * 0.7}s infinite` }} />
          ))}
          <div className="w-20 h-20 rounded-full bg-[#00A651] flex flex-col items-center justify-center relative z-10"
            style={{ boxShadow: "0 0 0 8px rgba(0,166,81,0.12), 0 4px 24px rgba(0,166,81,0.40)" }}>
            <span className="text-white font-bold text-xs leading-none">M</span>
            <span className="text-white font-bold text-lg leading-none">-</span>
            <span className="text-white font-bold text-xs leading-none">Pesa</span>
          </div>
        </div>

        <h1 className="font-semibold text-[var(--text-primary)] text-2xl mb-2">Check your phone</h1>
        <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-[260px] mb-8">
          Enter your M-Pesa PIN on the prompt to complete the booking.
        </p>

        {/* Countdown */}
        <div className="bg-[var(--bg-surface)] rounded-2xl px-8 py-4 mb-8 border border-[var(--border)]">
          <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-[0.18em] font-semibold mb-1">
            Session expires in
          </p>
          <p className="font-mono font-bold text-3xl text-[var(--text-primary)]">{mins}:{ss}</p>
        </div>

        <button onClick={() => { stopAll(); navigate(-1); }}
          className="text-[var(--text-muted)] text-sm underline">
          Cancel and go back
        </button>
      </div>
    </div>
  );
}
