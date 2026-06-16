import { useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Smartphone } from "lucide-react";
import { imgSrc } from "../utils/image";

interface PropertySummary {
  id: string; title: string; type: string;
  price_per_night: number; primary_image?: string; min_nights: number;
}

async function fetchProperty(id: string): Promise<PropertySummary> {
  const res = await fetch(`/api/properties/${id}`);
  if (!res.ok) throw new Error("Not found");
  const data = await res.json();
  const primary = data.images?.find((i: { is_primary: boolean }) => i.is_primary)?.cloudinary_url
    ?? data.images?.[0]?.cloudinary_url;
  return { ...data, primary_image: primary };
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between items-center text-sm ${bold ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

export default function Booking() {
  const { id }    = useParams<{ id: string }>();
  const [sp]      = useSearchParams();
  const navigate  = useNavigate();
  const checkIn   = sp.get("check_in") ?? "";
  const checkOut  = sp.get("check_out") ?? "";

  const [guests,        setGuests]        = useState(() => Math.max(1, Number(sp.get("guests") ?? "1")));
  const [promo,         setPromo]         = useState("");
  const [promoApplied,  setPromoApplied]  = useState(false);
  const [discount,      setDiscount]      = useState(0);
  const [isCorporate,   setIsCorporate]   = useState(false);
  const [groupName,     setGroupName]     = useState("");
  const [companyName,   setCompanyName]   = useState("");
  const [kraPin,        setKraPin]        = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");

  const { data: prop } = useQuery({
    queryKey: ["property", id],
    queryFn: () => fetchProperty(id!),
    enabled: !!id,
  });

  const nights = checkIn && checkOut
    ? Math.max(0, (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    : 0;
  const base  = (prop?.price_per_night ?? 0) * nights;
  const levy  = Math.round(base * 0.02);
  const fee   = 300;
  const total = Math.max(0, base + levy + fee - discount);

  function fmtDate(d: string) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
  }

  async function applyPromo() {
    if (!promo || promoApplied) return;
    // Optimistic: backend will validate on booking creation
    // For KES 500 early-adopter code, show immediate feedback
    setDiscount(500);
    setPromoApplied(true);
  }

  async function handleConfirm() {
    if (!termsAccepted) { setError("Please accept the terms to continue"); return; }
    if (!checkIn || !checkOut || nights === 0) { setError("Invalid dates"); return; }
    setLoading(true); setError("");
    try {
      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          property_id: id, check_in: checkIn, check_out: checkOut,
          guests, promo_code: promo || undefined, terms_accepted: true,
          group_name:   groupName   || undefined,
          is_corporate: isCorporate,
          company_name: isCorporate ? companyName : undefined,
          kra_pin:      isCorporate ? kraPin      : undefined,
        }),
      });
      if (bookingRes.status === 401) {
        navigate(`/profile?redirect=${encodeURIComponent(`/booking/${id}?check_in=${checkIn}&check_out=${checkOut}`)}`);
        return;
      }
      if (!bookingRes.ok) {
        const err = await bookingRes.json();
        setError(err.detail ?? "Booking failed — please try again");
        return;
      }
      const booking = await bookingRes.json();
      await fetch("/api/payments/mpesa/stk-push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ booking_id: booking.id }),
      });
      navigate(`/booking-confirm/${booking.id}`, {
        state: {
          propertyTitle: prop?.title,
          propertyImage: prop?.primary_image,
          propertyType:  prop?.type,
          checkIn, checkOut, nights, total,
        },
      });
    } catch {
      setError("Network error — check your connection and try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-20 pb-8">

      {/* Header — sits below the fixed TopBar */}
      <div className="sticky top-20 z-40 flex items-center gap-3 px-4 py-4 bg-[var(--bg-surface)] border-b border-[var(--border)]">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-[var(--bg-primary)] flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-semibold text-[var(--text-primary)] leading-none">Confirm booking</h1>
          {nights > 0 && <p className="text-xs text-[var(--text-muted)] mt-0.5">{nights} night{nights !== 1 ? "s" : ""}</p>}
        </div>
      </div>

      <div className="max-w-md mx-auto">

        {/* Property banner — tall, cinematic */}
        {prop && (
          <div className="relative overflow-hidden" style={{ height: 220 }}>
            {prop.primary_image
              ? <img src={imgSrc(prop.primary_image, 800)} alt={prop.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-r from-[var(--color-forest)] to-[var(--color-teal)]" />
            }
            <div className="absolute inset-0" style={{
              background: "linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.72) 100%)",
            }} />
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
              <p className="text-white font-semibold text-sm leading-snug">{prop.title}</p>
              <p className="text-white/60 text-xs mt-0.5 capitalize">{prop.type} · Naivasha, Kenya</p>
            </div>
          </div>
        )}

        {/* Dates pill */}
        <div className="mx-4 -mt-4 relative z-10 bg-[var(--bg-surface)] rounded-2xl shadow-lg px-4 py-3 flex items-center justify-between">
          <div className="text-center">
            <p className="text-[13px] text-[var(--text-muted)] uppercase tracking-wide font-medium">Check-in</p>
            <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{fmtDate(checkIn)}</p>
          </div>
          <div className="flex items-center gap-1 text-[var(--text-muted)]">
            <div className="w-8 h-px bg-[var(--border)]" />
            <span className="text-xs font-medium text-[var(--color-teal)]">{nights}n</span>
            <div className="w-8 h-px bg-[var(--border)]" />
          </div>
          <div className="text-center">
            <p className="text-[13px] text-[var(--text-muted)] uppercase tracking-wide font-medium">Check-out</p>
            <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{fmtDate(checkOut)}</p>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-3">

          {/* Price breakdown */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2.5">
            <p className="font-semibold text-[var(--text-primary)] mb-1">Price details</p>
            <Row label={`KES ${prop?.price_per_night.toLocaleString() ?? "—"} × ${nights} nights`} value={`KES ${base.toLocaleString()}`} />
            <Row label="Tourism levy (2%)" value={`KES ${levy.toLocaleString()}`} />
            <Row label="Convenience fee" value={`KES ${fee.toLocaleString()}`} />
            {discount > 0 && <Row label={`Promo: ${promo}`} value={`− KES ${discount.toLocaleString()}`} />}
            <div className="h-px bg-[var(--border)]" />
            <Row label="Total" value={`KES ${total.toLocaleString()}`} bold />
          </div>

          {/* Guests */}
          <div className="bg-[var(--bg-surface)] rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Guests</p>
              <p className="text-xs text-[var(--text-muted)]">How many people are staying?</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setGuests(g => Math.max(1, g - 1))}
                className="w-9 h-9 rounded-full border-2 border-[var(--border)] text-[var(--text-primary)] flex items-center justify-center text-xl font-light leading-none">−</button>
              <span className="text-base font-bold text-[var(--text-primary)] w-5 text-center">{guests}</span>
              <button onClick={() => setGuests(g => Math.min(20, g + 1))}
                className="w-9 h-9 rounded-full border-2 border-[var(--border)] text-[var(--text-primary)] flex items-center justify-center text-xl font-light leading-none">+</button>
            </div>
          </div>

          {/* Group / corporate booking */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Group or corporate booking?</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Retreats, offsite, family reunions, church trips</p>
              </div>
              <button type="button" onClick={() => setIsCorporate(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isCorporate ? "bg-[var(--color-forest)]" : "bg-[var(--border)]"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isCorporate ? "translate-x-5.5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {isCorporate && (
              <div className="space-y-3 pt-1">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-1">Trip / group name</p>
                  <input value={groupName} onChange={e => setGroupName(e.target.value)}
                    placeholder="e.g. Safaricom Q3 Offsite"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--color-teal)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-1">Company name <span className="text-[var(--color-teal)]">(for invoice)</span></p>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                    placeholder="e.g. Safaricom PLC"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--color-teal)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-1">KRA PIN <span className="text-[var(--color-teal)]">(for tax invoice)</span></p>
                  <input value={kraPin} onChange={e => setKraPin(e.target.value.toUpperCase())}
                    placeholder="e.g. P051234567A"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-[var(--color-teal)]" />
                </div>
                <p className="text-[13px] text-[var(--text-muted)]">
                  A formal invoice with KRA PIN will be generated and sent to your email after check-in.
                </p>
              </div>
            )}
          </div>

          {/* Promo code */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Promo code</p>
            <div className="flex gap-2">
              <input value={promo} onChange={e => setPromo(e.target.value.toUpperCase())}
                placeholder="e.g. NAIVASHA500"
                disabled={promoApplied}
                className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-xl px-3 py-2.5 outline-none disabled:opacity-60" />
              <button onClick={applyPromo} disabled={!promo || promoApplied}
                className="px-4 bg-[var(--color-forest)] disabled:bg-gray-300 text-white text-xs font-bold rounded-xl">
                {promoApplied ? "✓ Applied" : "Apply"}
              </button>
            </div>
            {promoApplied && <p className="text-xs text-[var(--color-teal)]">KES 500 discount applied</p>}
          </div>

          {/* Cancellation policy */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Cancellation policy</p>
            {[
              { pct: "100%", when: "48h+ before check-in",  color: "text-[var(--color-teal)]" },
              { pct: "50%",  when: "24–48h before check-in", color: "text-amber-600" },
              { pct: "0%",   when: "Less than 24h",          color: "text-red-500" },
            ].map(r => (
              <div key={r.when} className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">{r.when}</span>
                <span className={`text-xs font-bold ${r.color}`}>{r.pct} refund</span>
              </div>
            ))}
          </div>

          {/* Terms */}
          <label className={`flex gap-3 rounded-2xl p-4 cursor-pointer border transition-colors ${
            termsAccepted ? "bg-[var(--color-forest)]/8 border-[var(--color-forest)]/30" : "bg-[var(--bg-surface)] border-transparent"
          }`}>
            <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              termsAccepted ? "bg-[var(--color-forest)] border-[var(--color-forest)]" : "border-[var(--border)]"
            }`}>
              {termsAccepted && <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3}><path d="M20 6L9 17l-5-5" /></svg>}
            </div>
            <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="sr-only" />
            <span className="text-xs text-[var(--text-muted)] leading-relaxed">
              I agree to the{" "}
              <a href="/terms" className="text-[var(--color-teal)] font-medium">Terms of Service</a>,{" "}
              <a href="/cancellation-policy" className="text-[var(--color-teal)] font-medium">Cancellation Policy</a>, and{" "}
              <a href="/privacy" className="text-[var(--color-teal)] font-medium">Privacy Policy</a>.
            </span>
          </label>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <span className="text-red-500 text-sm">⚠</span>
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Escrow protection */}
          <div className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: "rgba(30,74,34,0.06)", border: "1px solid rgba(30,74,34,0.15)" }}>
            <ShieldCheck size={20} className="flex-shrink-0 text-[var(--color-forest)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-forest)]">Your payment is protected</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                KES {total.toLocaleString()} is held safely by StayNaivasha — not released to the owner
                until you physically arrive and check in. If the property doesn't match what was advertised,
                you get a full refund within 1 hour.
              </p>
            </div>
          </div>

          {/* M-Pesa CTA */}
          <button onClick={handleConfirm} disabled={loading || !termsAccepted}
            className="w-full flex items-center justify-center gap-3 text-white font-bold py-4 rounded-2xl transition-all active:scale-[.98] disabled:opacity-50"
            style={loading || !termsAccepted ? { background: "#9ca3af" } : {
              background: "linear-gradient(135deg, #00A651 0%, #007a3d 100%)",
              boxShadow: "0 4px 16px rgba(0,166,81,0.4)",
            }}>
            {loading
              ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending prompt…</>
              : <><Smartphone size={18} /> Pay KES {total.toLocaleString()} via M-Pesa</>
            }
          </button>

          <p className="text-xs text-center text-[var(--text-muted)] pb-4">
            You'll receive an M-Pesa STK Push prompt on your phone.<br />Enter your PIN to complete the booking.
          </p>
        </div>
      </div>
    </div>
  );
}
