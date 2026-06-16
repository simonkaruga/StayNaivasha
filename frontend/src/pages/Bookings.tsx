import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Clock, CheckCircle, Home as HomeIcon, CheckCircle2, XCircle, LockKeyhole } from "lucide-react";
import { generateBookingPDF } from "../utils/pdf";

interface Booking {
  id: string; property_id: string; property_title?: string;
  check_in: string; check_out: string;
  total_amount: number; platform_fee: number; status: string;
  checkin_code: string | null; mpesa_ref: string | null;
}

const STATUS: Record<string, { label: string; icon: React.ReactNode; dot: string; text: string }> = {
  pending:    { label: "Pending",    icon: <Clock className="w-3.5 h-3.5" />,        dot: "bg-amber-500",            text: "text-amber-700" },
  confirmed:  { label: "Confirmed",  icon: <CheckCircle className="w-3.5 h-3.5" />,  dot: "bg-blue-600",             text: "text-blue-700" },
  checked_in: { label: "Checked in", icon: <HomeIcon className="w-3.5 h-3.5" />,     dot: "bg-[var(--color-mint)]",  text: "text-[var(--color-teal)]" },
  completed:  { label: "Completed",  icon: <CheckCircle2 className="w-3.5 h-3.5" />, dot: "bg-gray-500",             text: "text-[var(--text-muted)]" },
  cancelled:  { label: "Cancelled",  icon: <XCircle className="w-3.5 h-3.5" />,      dot: "bg-red-600",              text: "text-red-700" },
};

type Tab = "all" | "upcoming" | "completed" | "cancelled";

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api${path}`, { credentials: "include", ...opts });

// ── Review bottom sheet ───────────────────────────────────────────────────────

function ReviewSheet({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [scores, setScores] = useState({ accuracy_score: 5, cleanliness_score: 5, location_score: 5, value_score: 5 });
  const [comment, setComment] = useState("");
  const [err, setErr] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const r = await api("/reviews/", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, ...scores, comment: comment || null }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail ?? "Failed"); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-bookings"] }); onClose(); },
    onError: (e: Error) => setErr(e.message),
  });

  const DIMS = [
    { key: "accuracy_score",    label: "Accuracy" },
    { key: "cleanliness_score", label: "Cleanliness" },
    { key: "location_score",    label: "Location" },
    { key: "value_score",       label: "Value" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-surface)] rounded-t-3xl px-5 pt-4 pb-10 space-y-4"
        style={{ animation: "fade-up 0.2s ease-out both" }}>
        <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto" />
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-primary)]">Leave a review</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-muted)]">✕</button>
        </div>

        {DIMS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)] w-24">{label}</span>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setScores(s => ({ ...s, [key]: n }))}
                  className={`text-2xl transition-transform active:scale-90 ${scores[key] >= n ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}`}>
                  ★
                </button>
              ))}
            </div>
          </div>
        ))}

        <textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Share your experience… (optional)"
          rows={3}
          className="w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl px-4 py-3 text-sm outline-none resize-none focus:border-[var(--color-teal)] transition-colors" />

        {err && <p className="text-red-500 text-sm">{err}</p>}

        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-sm">
          {mut.isPending ? "Submitting…" : "Submit review"}
        </button>
      </div>
    </div>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────

function BookingCard({ b, onReview, onCancel, cancelling, confirmCancel, onCancelRequest }: {
  b: Booking;
  onReview: (id: string) => void;
  onCancel: (id: string) => void;
  cancelling: boolean;
  confirmCancel: boolean;
  onCancelRequest: (id: string | null) => void;
}) {
  const s = STATUS[b.status] ?? STATUS.pending;
  const nights = Math.max(1, (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short" });

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl overflow-hidden shadow-sm"
      style={{ animation: "fade-up 0.25s ease-out both" }}>

      {/* Colour strip per status */}
      <div className={`h-1 ${s.dot}`} />

      <div className="p-4 space-y-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {/* Shape + colour: both convey status, not colour alone */}
              <span className="text-sm leading-none" aria-hidden="true">{s.icon}</span>
              <span className={`text-xs font-semibold ${s.text}`}>{s.label}</span>
            </div>
            {b.property_title && (
              <p className="font-semibold text-[var(--text-primary)] text-sm leading-snug mb-0.5 line-clamp-1">{b.property_title}</p>
            )}
            <p className="text-[13px] text-[var(--text-muted)]">
              {fmtDate(b.check_in)} → {fmtDate(b.check_out)}
              <span className="ml-1.5">{Math.round(nights)} nights</span>
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-[var(--text-primary)]">KES {b.total_amount.toLocaleString()}</p>
            {b.mpesa_ref && <p className="text-[13px] text-[var(--text-muted)] font-mono mt-0.5">{b.mpesa_ref}</p>}
          </div>
        </div>

        {/* Check-in code */}
        {b.checkin_code && b.status === "confirmed" && (
          <div className="bg-[var(--bg-primary)] rounded-xl px-4 py-3 flex items-center justify-between border border-[var(--color-forest)]/20">
            <p className="text-xs text-[var(--text-muted)]">Check-in code</p>
            <div className="flex gap-1.5">
              {b.checkin_code.split("").map((d, i) => (
                <div key={i} className="w-9 h-10 rounded-lg bg-[var(--color-forest)]/10 border border-[var(--color-forest)]/30 flex items-center justify-center">
                  <span className="font-mono font-bold text-lg text-[var(--color-forest)]">{d}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {b.status === "checked_in" && (
          <div className="flex items-center gap-2 bg-[var(--color-teal)]/10 rounded-xl px-3 py-2">
            <span className="text-[var(--color-teal)] text-sm">✓</span>
            <p className="text-xs text-[var(--color-teal)] font-medium">Checked in · Payout processing</p>
          </div>
        )}

        {/* Cancel confirmation inline */}
        {confirmCancel && (b.status === "pending" || b.status === "confirmed") && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 space-y-2.5">
            <p className="text-sm font-semibold text-red-700">Cancel this booking?</p>
            <p className="text-xs text-red-600 leading-relaxed">
              {(new Date(b.check_in).getTime() - Date.now()) / 86400000 >= 7
                ? "You'll receive a full refund since check-in is 7+ days away."
                : (new Date(b.check_in).getTime() - Date.now()) / 86400000 >= 3
                ? "You'll receive a 50% refund — check-in is 3–7 days away."
                : "No refund applies — check-in is less than 3 days away."}
            </p>
            <div className="flex gap-2">
              <button onClick={() => onCancel(b.id)} disabled={cancelling}
                className="flex-1 bg-red-500 disabled:bg-red-300 text-white text-xs font-bold py-2.5 rounded-xl">
                {cancelling ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button onClick={() => onCancelRequest(null)} disabled={cancelling}
                className="flex-1 border border-[var(--border)] text-[var(--text-muted)] text-xs font-medium py-2.5 rounded-xl">
                Keep booking
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {(b.status === "confirmed" || b.status === "completed") && (
            <button onClick={() => generateBookingPDF({ ...b, checkin_code: b.checkin_code ?? "", platform_fee: b.platform_fee ?? 0 })}
              className="flex-1 flex items-center justify-center gap-1.5 border border-[var(--border)] text-[var(--text-muted)] text-xs py-2.5 rounded-xl font-medium">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              PDF
            </button>
          )}
          {b.status === "completed" && (
            <button onClick={() => onReview(b.id)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-amber-50 text-amber-600 border border-amber-200 text-xs py-2.5 rounded-xl font-semibold">
              ★ Review stay
            </button>
          )}
          {(b.status === "pending" || b.status === "confirmed") && !confirmCancel && (
            <button onClick={() => onCancelRequest(b.id)}
              className="flex-1 flex items-center justify-center gap-1 border border-red-200 text-red-500 text-xs py-2.5 rounded-xl font-medium">
              Cancel
            </button>
          )}
          <Link to={`/property/${b.property_id}`}
            className="flex-1 flex items-center justify-center gap-1 border border-[var(--border)] text-[var(--text-muted)] text-xs py-2.5 rounded-xl font-medium">
            View home
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Bookings() {
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const [tab,          setTab]          = useState<Tab>("all");
  const [reviewId,     setReviewId]     = useState<string | null>(null);
  const [cancelling,   setCancelling]   = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [cancelNotice,  setCancelNotice]  = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<Booking[], Error>({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      const r = await api("/bookings/mine");
      if (r.status === 401) throw new Error("unauth");
      if (!r.ok) return [];
      return r.json();
    },
    retry: false,
  });

  async function cancelBooking(id: string) {
    setCancelling(id);
    const r = await api(`/bookings/${id}/cancel`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Guest cancellation" }),
    });
    setCancelling(null);
    setCancelConfirm(null);
    if (r.ok) {
      const d = await r.json();
      const msg = d.refund_amount > 0
        ? `Booking cancelled — KES ${d.refund_amount.toLocaleString()} refund (${d.refund_pct}%) will be processed within 3–5 business days.`
        : "Booking cancelled. No refund applies at this stage.";
      setCancelNotice(msg);
      setTimeout(() => setCancelNotice(null), 7000);
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    }
  }

  if (error?.message === "unauth") return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 pb-20 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
        <LockKeyhole className="w-7 h-7 text-[var(--text-muted)]" />
      </div>
      <p className="font-semibold text-[var(--text-primary)]">Sign in to see your bookings</p>
      <button onClick={() => navigate("/profile")}
        className="bg-[var(--color-forest)] text-white text-sm font-bold px-8 py-3.5 rounded-2xl">
        Sign in
      </button>
    </div>
  );

  const TAB_FILTER: Record<Tab, (b: Booking) => boolean> = {
    all:       () => true,
    upcoming:  b => ["pending","confirmed"].includes(b.status),
    completed: b => ["checked_in","completed"].includes(b.status),
    cancelled: b => b.status === "cancelled",
  };
  const filtered = data?.filter(TAB_FILTER[tab]) ?? [];

  const TABS: { id: Tab; label: string }[] = [
    { id: "all",       label: "All" },
    { id: "upcoming",  label: "Upcoming" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-20 pb-6">

      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--bg-surface)] border-b border-[var(--border)]">
        <div className="px-4 pt-4 pb-0">
          <h1 className="font-semibold text-[var(--text-primary)] text-lg">Your bookings</h1>
          {data && <p className="text-xs text-[var(--text-muted)] mt-0.5">{data.length} stay{data.length !== 1 ? "s" : ""} total</p>}
        </div>
        <div className="flex gap-1 px-4 py-2.5 overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tab === t.id
                  ? "bg-[var(--color-forest)] text-white"
                  : "text-[var(--text-muted)] bg-[var(--bg-primary)]"
              }`}>
              {t.label}
              {t.id !== "all" && data && (
                <span className="ml-1 opacity-70">
                  {data.filter(TAB_FILTER[t.id]).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {cancelNotice && (
        <div className="mx-4 mt-3 flex items-start gap-3 bg-[var(--color-teal)]/10 border border-[var(--color-teal)]/30 rounded-2xl px-4 py-3">
          <span className="text-[var(--color-teal)] text-lg flex-shrink-0">✓</span>
          <p className="text-sm text-[var(--color-teal)] leading-relaxed">{cancelNotice}</p>
          <button onClick={() => setCancelNotice(null)} className="ml-auto text-[var(--color-teal)]/60 text-xs flex-shrink-0">✕</button>
        </div>
      )}

      {/* Review nudge — shown when there are completed stays without a review */}
      {!isLoading && (data?.filter(b => b.status === "completed").length ?? 0) > 0 && tab !== "cancelled" && (
        <div className="mx-4 mt-3 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <span className="text-xl flex-shrink-0">✍️</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--text-primary)]">You have completed stays</p>
            <p className="text-[13px] text-[var(--text-muted)]">Leave a review — it helps other guests and rewards great hosts.</p>
          </div>
          <button onClick={() => setTab("completed")}
            className="flex-shrink-0 text-[13px] font-bold text-amber-700 underline underline-offset-2">
            Review
          </button>
        </div>
      )}

      <div className="px-4 pt-4 space-y-3">

        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-[var(--bg-surface)] rounded-2xl h-32 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-3xl">📅</div>
            <p className="font-semibold text-[var(--text-primary)]">
              {tab === "all" ? "No bookings yet" : `No ${tab} bookings`}
            </p>
            {tab === "all" && (
              <>
                <p className="text-sm text-[var(--text-muted)] max-w-[200px]">Browse verified homes and make your first booking today.</p>
                <button onClick={() => navigate("/")}
                  className="bg-[var(--color-forest)] text-white text-sm font-bold px-8 py-3.5 rounded-2xl">
                  Browse homes
                </button>
              </>
            )}
            {tab !== "all" && (
              <button onClick={() => setTab("all")} className="text-[var(--color-teal)] text-sm underline">
                Show all bookings
              </button>
            )}
          </div>
        )}

        {filtered.map(b => (
          <BookingCard key={b.id} b={b}
            onReview={setReviewId}
            onCancel={cancelBooking}
            cancelling={cancelling === b.id}
            confirmCancel={cancelConfirm === b.id}
            onCancelRequest={setCancelConfirm}
          />
        ))}
      </div>

      {reviewId && <ReviewSheet bookingId={reviewId} onClose={() => setReviewId(null)} />}
    </div>
  );
}
