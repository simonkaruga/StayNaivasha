import { useNavigate, Link } from "react-router-dom";
import { useSEO } from "../utils/seo";

export default function HowItWorks() {
  const navigate = useNavigate();
  useSEO({
    title: "How StayNaivasha Works",
    description: "Learn how StayNaivasha's M-Pesa escrow, property verification and instant booking works.",
  });

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">

      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center gap-3 px-4 py-4 bg-[var(--bg-surface)] border-b border-[var(--border)]">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-[var(--bg-primary)] flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-semibold text-[var(--text-primary)]">How it works</h1>
      </div>

      <div className="px-5 pt-6 max-w-lg mx-auto space-y-8 pb-8">

        {/* Hero blurb */}
        <div className="space-y-2">
          <p className="text-[10px] text-[var(--color-teal)] font-semibold tracking-[0.25em] uppercase">Kenya's local-first platform</p>
          <h2 className="font-display italic text-3xl text-[var(--text-primary)] leading-tight">
            Book in 30 seconds.<br />Pay via M-Pesa.<br />Protected always.
          </h2>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            StayNaivasha is built for Kenyans, by Avinaya Solutions. No dollar cards, no international friction —
            just your phone, your PIN, and a verified home waiting for you.
          </p>
        </div>

        {/* For guests */}
        <section className="space-y-4">
          <h3 className="font-semibold text-[var(--text-primary)] text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--color-forest)] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">G</span>
            For guests
          </h3>

          {[
            {
              n: "1",
              title: "Browse verified homes",
              body: "Every property is reviewed by the StayNaivasha team before going live. Photos are approved, GPS coordinates confirmed, and the owner's identity checked.",
              icon: "🏡",
            },
            {
              n: "2",
              title: "Pick your dates & guests",
              body: "Select check-in and check-out dates on the real-time availability calendar. Dates blocked by other bookings or the owner are greyed out automatically.",
              icon: "📅",
            },
            {
              n: "3",
              title: "Pay via M-Pesa STK Push",
              body: "Tap Reserve and you'll receive an M-Pesa prompt on your phone. Enter your PIN — the whole process takes under 30 seconds. KES only, no card needed.",
              icon: "📱",
            },
            {
              n: "4",
              title: "Your money is held in escrow",
              body: "Your payment is held securely and NOT released to the owner until you check in. If anything goes wrong before arrival, you are protected.",
              icon: "🔒",
            },
            {
              n: "5",
              title: "Check in with your code",
              body: "After booking you receive a 4-digit check-in code. Show it to the owner on arrival. They enter it to confirm you're there — which triggers the payout.",
              icon: "✅",
            },
          ].map(step => (
            <div key={step.n} className="flex gap-4 bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border)]">
              <span className="text-2xl flex-shrink-0 mt-0.5">{step.icon}</span>
              <div>
                <p className="font-semibold text-[var(--text-primary)] text-sm">{step.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </section>

        {/* For owners */}
        <section className="space-y-4">
          <h3 className="font-semibold text-[var(--text-primary)] text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--color-amber)] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">O</span>
            For property owners
          </h3>

          {[
            {
              title: "List for free",
              body: "Creating a listing is free. Zero commission for your first 3 months. After that, a flat KES 300 convenience fee per booking — that's it.",
              icon: "✍️",
            },
            {
              title: "AI writes your description",
              body: "Tell our AI what you have — bedrooms, amenities, views — and it writes a compelling description in seconds. You can edit it before publishing.",
              icon: "🤖",
            },
            {
              title: "Get verified for more bookings",
              body: "Verified tier 2 properties appear higher in search and get a Verified badge. The process takes 24–48 hours and involves a photo review.",
              icon: "🏅",
            },
            {
              title: "Payout within 2 hours of check-in",
              body: "Once a guest checks in and their 4-digit code is confirmed, the escrow is released to your M-Pesa within 2 hours. No waiting days.",
              icon: "💸",
            },
          ].map(step => (
            <div key={step.title} className="flex gap-4 bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border)]">
              <span className="text-2xl flex-shrink-0 mt-0.5">{step.icon}</span>
              <div>
                <p className="font-semibold text-[var(--text-primary)] text-sm">{step.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Cancellation quick ref */}
        <section className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border)] space-y-3">
          <h3 className="font-semibold text-[var(--text-primary)] text-sm">Cancellation at a glance</h3>
          {[
            { when: "48h+ before check-in", refund: "100%", color: "text-[var(--color-teal)]" },
            { when: "24–48h before check-in", refund: "50%", color: "text-amber-600" },
            { when: "Under 24h", refund: "0%", color: "text-red-500" },
            { when: "Owner cancels for any reason", refund: "100%", color: "text-[var(--color-teal)]" },
          ].map(r => (
            <div key={r.when} className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">{r.when}</span>
              <span className={`text-xs font-bold ${r.color}`}>{r.refund} refund</span>
            </div>
          ))}
          <Link to="/cancellation-policy" className="text-xs text-[var(--color-teal)] font-medium underline underline-offset-2">
            Full cancellation policy →
          </Link>
        </section>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Link to="/search"
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl text-sm"
            style={{ background: "linear-gradient(135deg, #1e4a22 0%, #2a6838 100%)", boxShadow: "0 4px 14px rgba(30,74,34,.35)" }}>
            Browse homes
          </Link>
          <Link to="/owner"
            className="w-full flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--text-primary)] font-semibold py-4 rounded-2xl text-sm">
            List your property
          </Link>
        </div>
      </div>
    </div>
  );
}
