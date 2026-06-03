import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { generateBookingPDF } from "../utils/pdf";

type PaymentStatus = "pending" | "confirmed" | "cancelled" | "timeout";

interface BookingStatus {
  booking_id: string;
  status: string;
  mpesa_ref: string | null;
}

interface BookingDetail {
  id: string;
  property_id: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  checkin_code: string;
  mpesa_ref: string | null;
  status: string;
}

const POLL_INTERVAL = 3000; // 3 seconds — session timeout is 600s matching Redis lock TTL

export default function BookingConfirm() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();

  const [stage, setStage] = useState<PaymentStatus>("pending");
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(600);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopAll() {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  useEffect(() => {
    if (!bookingId) return;

    // Countdown display
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          stopAll();
          setStage("timeout");
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    // Poll payment status
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/mpesa/status/${bookingId}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data: BookingStatus = await res.json();

        if (data.status === "confirmed") {
          stopAll();
          // Fetch full booking detail for confirmation screen
          const detailRes = await fetch(`/api/bookings/${bookingId}`, { credentials: "include" });
          if (detailRes.ok) setBooking(await detailRes.json());
          setStage("confirmed");
        } else if (data.status === "cancelled") {
          stopAll();
          setStage("cancelled");
        }
      } catch {
        // Network blip — keep polling
      }
    }, POLL_INTERVAL);

    return stopAll;
  }, [bookingId]);

  function handleRetry() {
    navigate(-1);
  }

  function handleDownloadPDF() {
    if (!booking) return;
    generateBookingPDF(booking);
  }

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  // ── Confirmed ──
  if (stage === "confirmed" && booking) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 pb-20 text-center">
        <div className="w-20 h-20 rounded-full bg-[var(--color-mint)] flex items-center justify-center text-4xl mb-6">
          ✓
        </div>
        <h1 className="font-display italic text-3xl text-[var(--text-primary)] mb-2">
          You're booked!
        </h1>
        <p className="text-[var(--text-muted)] text-sm mb-8">
          M-Pesa ref: <span className="font-mono font-medium text-[var(--text-primary)]">{booking.mpesa_ref}</span>
        </p>

        {/* Check-in code */}
        <div className="bg-[var(--bg-surface)] rounded-2xl p-6 w-full max-w-sm mb-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">Your check-in code</p>
          <p className="font-mono text-5xl font-bold text-[var(--color-forest)] tracking-[0.3em]">
            {booking.checkin_code}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Show this to the owner on arrival
          </p>
        </div>

        {/* Dates */}
        <div className="bg-[var(--bg-surface)] rounded-2xl p-4 w-full max-w-sm mb-6 text-sm">
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>Check-in</span>
            <span className="text-[var(--text-primary)] font-medium">{booking.check_in}</span>
          </div>
          <div className="flex justify-between text-[var(--text-muted)] mt-2">
            <span>Check-out</span>
            <span className="text-[var(--text-primary)] font-medium">{booking.check_out}</span>
          </div>
          <div className="flex justify-between text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border)]">
            <span>Total paid</span>
            <span className="text-[var(--text-primary)] font-semibold">
              KES {booking.total_amount.toLocaleString()}
            </span>
          </div>
        </div>

        <button
          onClick={handleDownloadPDF}
          className="w-full max-w-sm bg-[var(--color-forest)] text-white font-semibold py-3.5 rounded-2xl mb-3 text-sm"
        >
          Download PDF confirmation
        </button>
        <button
          onClick={() => navigate("/")}
          className="w-full max-w-sm border border-[var(--border)] text-[var(--text-muted)] py-3.5 rounded-2xl text-sm"
        >
          Back to home
        </button>
      </div>
    );
  }

  // ── Timeout ──
  if (stage === "timeout") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 pb-20 text-center">
        <div className="text-5xl mb-6">⏱️</div>
        <h1 className="font-semibold text-[var(--text-primary)] text-xl mb-2">Session expired</h1>
        <p className="text-[var(--text-muted)] text-sm mb-8 max-w-xs">
          The M-Pesa prompt timed out. Your dates have been released.
          You have <strong>not</strong> been charged.
        </p>
        <button
          onClick={handleRetry}
          className="w-full max-w-sm bg-[var(--color-mint)] text-[var(--color-nearblack)] font-semibold py-3.5 rounded-2xl text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Cancelled by guest ──
  if (stage === "cancelled") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 pb-20 text-center">
        <div className="text-5xl mb-6">❌</div>
        <h1 className="font-semibold text-[var(--text-primary)] text-xl mb-2">Payment cancelled</h1>
        <p className="text-[var(--text-muted)] text-sm mb-8">You have not been charged.</p>
        <button
          onClick={handleRetry}
          className="w-full max-w-sm bg-[var(--color-forest)] text-white font-semibold py-3.5 rounded-2xl text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Waiting for PIN ──
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 pb-20 text-center">
      <div className="w-20 h-20 rounded-full border-4 border-[var(--color-mint)] border-t-transparent animate-spin mb-8" />
      <h1 className="font-semibold text-[var(--text-primary)] text-xl mb-2">
        Waiting for M-Pesa
      </h1>
      <p className="text-[var(--text-muted)] text-sm max-w-xs mb-6">
        Enter your M-Pesa PIN on the prompt sent to your phone to complete the booking.
      </p>
      <p className="text-xs text-[var(--text-muted)]">
        Session expires in{" "}
        <span className="font-mono font-semibold text-[var(--text-primary)]">
          {mins}:{secs}
        </span>
      </p>
      <button
        onClick={handleRetry}
        className="mt-8 text-[var(--text-muted)] text-xs underline"
      >
        Cancel and go back
      </button>
    </div>
  );
}
