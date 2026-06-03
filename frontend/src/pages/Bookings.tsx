import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { generateBookingPDF } from "../utils/pdf";
import SkeletonCard from "../components/SkeletonCard";

interface Booking {
  id: string;
  property_id: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  status: string;
  checkin_code: string | null;
  mpesa_ref: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700",
  confirmed:  "bg-blue-100 text-blue-700",
  checked_in: "bg-[var(--color-mint)]/20 text-[var(--color-teal)]",
  completed:  "bg-gray-100 text-gray-600",
  cancelled:  "bg-red-100 text-red-600",
};

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api${path}`, { credentials: "include", ...opts });

async function fetchMyBookings(): Promise<Booking[]> {
  const res = await api("/bookings/mine");
  if (res.status === 401) throw new Error("unauth");
  if (!res.ok) return [];
  return res.json();
}

// ── Review Modal ──────────────────────────────────────────────────────────────

function ReviewModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [scores, setScores] = useState({ accuracy_score: 5, cleanliness_score: 5, location_score: 5, value_score: 5 });
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api("/reviews/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, ...scores, comment: comment || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? "Failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const ratingLabels = ["accuracy", "cleanliness", "location", "value"] as const;
  const keyMap: Record<typeof ratingLabels[number], keyof typeof scores> = {
    accuracy: "accuracy_score",
    cleanliness: "cleanliness_score",
    location: "location_score",
    value: "value_score",
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <div className="bg-[var(--bg-surface)] rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-[var(--text-primary)]">Leave a review</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] text-xl leading-none">×</button>
        </div>

        {ratingLabels.map(label => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)] capitalize">{label}</span>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setScores(s => ({ ...s, [keyMap[label]]: n }))}
                  className={`text-xl ${scores[keyMap[label]] >= n ? "text-amber-400" : "text-gray-300"}`}>
                  ★
                </button>
              ))}
            </div>
          </div>
        ))}

        <textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Share your experience… (optional)"
          rows={3}
          className="w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl text-sm">
          {mutation.isPending ? "Submitting…" : "Submit review"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Bookings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: fetchMyBookings,
    retry: false,
  });

  async function cancelBooking(id: string) {
    if (!confirm("Cancel this booking? Refund depends on cancellation policy.")) return;
    setCancelling(id);
    const res = await api(`/bookings/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Guest cancellation" }),
    });
    setCancelling(null);
    if (res.ok) {
      const d = await res.json();
      const msg = d.refund_amount > 0
        ? `Booking cancelled. Refund of KES ${d.refund_amount.toLocaleString()} (${d.refund_pct}%) will be processed.`
        : "Booking cancelled. No refund applies at this stage.";
      alert(msg);
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    }
  }

  if (error?.message === "unauth") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 pb-20 text-center space-y-4">
        <span className="text-5xl">🔐</span>
        <p className="font-medium text-[var(--text-primary)]">Sign in to see your bookings</p>
        <button onClick={() => navigate("/profile")}
          className="bg-[var(--color-forest)] text-white text-sm font-medium px-6 py-3 rounded-xl">
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-20 px-4 pt-6">
      <h1 className="font-semibold text-[var(--text-primary)] mb-4">Your bookings</h1>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {!isLoading && data?.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center space-y-3">
          <span className="text-5xl">📅</span>
          <p className="font-medium text-[var(--text-primary)]">No bookings yet</p>
          <p className="text-sm text-[var(--text-muted)]">When you book a home, it will appear here.</p>
          <button onClick={() => navigate("/")}
            className="bg-[var(--color-forest)] text-white text-sm font-medium px-6 py-3 rounded-xl">
            Browse homes
          </button>
        </div>
      )}

      <div className="space-y-3">
        {data?.map(b => (
          <div key={b.id} className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-[var(--text-primary)] text-sm">
                  {b.check_in} → {b.check_out}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  KES {b.total_amount.toLocaleString()}
                  {b.mpesa_ref && <span className="ml-2 font-mono">{b.mpesa_ref}</span>}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                {b.status}
              </span>
            </div>

            {b.checkin_code && b.status === "confirmed" && (
              <div className="bg-[var(--bg-primary)] rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-xs text-[var(--text-muted)]">Check-in code</p>
                <p className="font-mono font-bold text-2xl text-[var(--color-forest)] tracking-widest">
                  {b.checkin_code}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              {(b.status === "confirmed" || b.status === "completed") && (
                <button
                  onClick={() => generateBookingPDF({ ...b, checkin_code: b.checkin_code ?? "" })}
                  className="flex-1 border border-[var(--border)] text-[var(--text-muted)] text-xs py-2.5 rounded-xl">
                  Download PDF
                </button>
              )}

              {b.status === "completed" && (
                <button onClick={() => setReviewBookingId(b.id)}
                  className="flex-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs py-2.5 rounded-xl font-medium">
                  ★ Review
                </button>
              )}

              {(b.status === "pending" || b.status === "confirmed") && (
                <button
                  onClick={() => cancelBooking(b.id)}
                  disabled={cancelling === b.id}
                  className="flex-1 border border-red-200 text-red-600 text-xs py-2.5 rounded-xl disabled:opacity-50">
                  {cancelling === b.id ? "Cancelling…" : "Cancel"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {reviewBookingId && (
        <ReviewModal bookingId={reviewBookingId} onClose={() => setReviewBookingId(null)} />
      )}
    </div>
  );
}
