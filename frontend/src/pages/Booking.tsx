import { useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

interface PropertySummary {
  id: string;
  title: string;
  price_per_night: number;
  primary_image?: string;
  min_nights: number;
}

async function fetchProperty(id: string): Promise<PropertySummary> {
  const res = await fetch(`/api/properties/${id}`);
  if (!res.ok) throw new Error("Not found");
  const data = await res.json();
  const primary = data.images?.find((i: { is_primary: boolean }) => i.is_primary)?.cloudinary_url
    ?? data.images?.[0]?.cloudinary_url;
  return { ...data, primary_image: primary };
}

export default function Booking() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const checkIn = searchParams.get("check_in") ?? "";
  const checkOut = searchParams.get("check_out") ?? "";

  const [promoCode, setPromoCode] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: prop } = useQuery({
    queryKey: ["property", id],
    queryFn: () => fetchProperty(id!),
    enabled: !!id,
  });

  const nights = checkIn && checkOut
    ? Math.max(0, (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    : 0;

  const base = prop ? prop.price_per_night * nights : 0;
  const levy = Math.round(base * 0.02);
  const fee = 300;
  const total = base + levy + fee;

  async function handleConfirm() {
    if (!termsAccepted) { setError("Please accept the terms to continue"); return; }
    if (!checkIn || !checkOut || nights === 0) { setError("Invalid dates"); return; }

    setLoading(true);
    setError("");

    try {
      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          property_id: id,
          check_in: checkIn,
          check_out: checkOut,
          guests: 1,
          promo_code: promoCode || undefined,
          terms_accepted: true,
        }),
      });

      if (bookingRes.status === 401) {
        navigate(`/profile?redirect=/booking/${id}?check_in=${checkIn}&check_out=${checkOut}`);
        return;
      }
      if (!bookingRes.ok) {
        const err = await bookingRes.json();
        setError(err.detail ?? "Booking failed — please try again");
        return;
      }

      const booking = await bookingRes.json();

      // Trigger STK Push
      await fetch("/api/payments/mpesa/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ booking_id: booking.id }),
      });

      navigate(`/booking-confirm/${booking.id}`);
    } catch {
      setError("Network error — check your connection and try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)]">
        <button onClick={() => navigate(-1)} className="text-[var(--text-primary)] text-xl">‹</button>
        <h1 className="font-semibold text-[var(--text-primary)]">Confirm booking</h1>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-md mx-auto">
        {/* Property summary */}
        {prop && (
          <div className="flex gap-3 bg-[var(--bg-surface)] rounded-2xl p-3">
            {prop.primary_image && (
              <img src={prop.primary_image} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-medium text-[var(--text-primary)] text-sm leading-snug line-clamp-2">{prop.title}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {checkIn} → {checkOut} · {nights} night{nights !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        )}

        {/* Price breakdown */}
        <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-2 text-sm">
          <p className="font-medium text-[var(--text-primary)] mb-3">Price breakdown</p>
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>KES {prop?.price_per_night.toLocaleString()} × {nights} nights</span>
            <span>KES {base.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>Tourism levy (2%)</span>
            <span>KES {levy.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>Convenience fee</span>
            <span>KES {fee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold text-[var(--text-primary)] pt-2 border-t border-[var(--border)]">
            <span>Total</span>
            <span>KES {total.toLocaleString()}</span>
          </div>
        </div>

        {/* Promo code */}
        <div className="bg-[var(--bg-surface)] rounded-2xl p-4">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-2">Promo code</p>
          <input
            value={promoCode}
            onChange={e => setPromoCode(e.target.value.toUpperCase())}
            placeholder="Enter code e.g. NAIVASHA500"
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-xl px-3 py-2 outline-none"
          />
        </div>

        {/* Terms */}
        <label className="flex gap-3 bg-[var(--bg-surface)] rounded-2xl p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={e => setTermsAccepted(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-[var(--color-forest)]"
          />
          <span className="text-sm text-[var(--text-muted)] leading-relaxed">
            I agree to the{" "}
            <a href="/terms" className="text-[var(--color-teal)] underline">Terms of Service</a>,{" "}
            <a href="/cancellation-policy" className="text-[var(--color-teal)] underline">Cancellation Policy</a>, and{" "}
            <a href="/privacy" className="text-[var(--color-teal)] underline">Privacy Policy</a>.
          </span>
        </label>

        {error && (
          <p className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3">{error}</p>
        )}

        {/* M-Pesa CTA */}
        <button
          onClick={handleConfirm}
          disabled={loading || !termsAccepted}
          className="w-full bg-[#00A651] disabled:bg-gray-300 text-white font-semibold py-4 rounded-2xl text-sm transition-colors"
        >
          {loading ? "Sending M-Pesa prompt…" : `Pay KES ${total.toLocaleString()} via M-Pesa`}
        </button>

        <p className="text-xs text-center text-[var(--text-muted)]">
          You'll receive an M-Pesa prompt on your phone. Enter your PIN to confirm.
        </p>
      </div>
    </div>
  );
}
