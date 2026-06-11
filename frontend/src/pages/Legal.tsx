import { useNavigate } from "react-router-dom";

const CONTENT: Record<string, { title: string; body: React.ReactNode }> = {
  terms: {
    title: "Terms of Service",
    body: (
      <div className="space-y-5 text-sm text-[var(--text-muted)] leading-relaxed">
        <p>By using StayNaivasha you agree to the following terms. Please read them carefully.</p>

        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--text-primary)]">1. Bookings</h2>
          <p>All bookings are confirmed only after successful M-Pesa payment. The platform acts as a payment intermediary via escrow — funds are held until guest check-in is confirmed by the property owner.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--text-primary)]">2. Guest Conduct</h2>
          <p>Guests are expected to respect the property and follow house rules provided by the owner. Any damage to the property may result in additional charges.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--text-primary)]">3. Platform Fees</h2>
          <p>A KES 300 convenience fee applies per booking. A 2% tourism levy is collected in accordance with Kenyan law. These are included in the total shown at checkout.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--text-primary)]">4. Liability</h2>
          <p>StayNaivasha is a marketplace connecting guests with property owners. We are not liable for disputes between guests and owners beyond the escrow protection provided.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--text-primary)]">5. Changes</h2>
          <p>We may update these terms at any time. Continued use of the platform constitutes acceptance of any revised terms.</p>
        </section>

        <p className="text-xs">Last updated: January 2025</p>
      </div>
    ),
  },
  privacy: {
    title: "Privacy Policy",
    body: (
      <div className="space-y-5 text-sm text-[var(--text-muted)] leading-relaxed">
        <p>StayNaivasha collects minimal data necessary to provide the booking service.</p>

        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--text-primary)]">Data We Collect</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Phone number (for authentication via OTP)</li>
            <li>Booking details (dates, property, payment reference)</li>
            <li>Optional display name</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--text-primary)]">How We Use It</h2>
          <p>Your data is used solely to process bookings, send booking confirmations, and communicate about your stay. We do not sell your data to third parties.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--text-primary)]">M-Pesa Payments</h2>
          <p>Payment processing is handled by Safaricom M-Pesa. We store only the transaction reference number. Your PIN is never seen or stored by us.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--text-primary)]">Data Retention</h2>
          <p>Booking records are retained for 7 years as required by Kenyan tax law. You may request deletion of your account by contacting support.</p>
        </section>

        <p className="text-xs">Last updated: January 2025</p>
      </div>
    ),
  },
  cancellation: {
    title: "Cancellation Policy",
    body: (
      <div className="space-y-5 text-sm text-[var(--text-muted)] leading-relaxed">
        <p>We understand plans change. Here's how refunds work:</p>

        <div className="space-y-3">
          {[
            { when: "More than 48 hours before check-in", refund: "100% refund", color: "text-[var(--color-teal)]", bg: "bg-[var(--color-teal)]/8" },
            { when: "24–48 hours before check-in", refund: "50% refund", color: "text-amber-600", bg: "bg-amber-50" },
            { when: "Less than 24 hours before check-in", refund: "No refund", color: "text-red-500", bg: "bg-red-50" },
          ].map(r => (
            <div key={r.when} className={`${r.bg} rounded-2xl p-4 flex items-center justify-between`}>
              <span className="text-[var(--text-primary)] font-medium text-sm">{r.when}</span>
              <span className={`font-bold text-sm ${r.color}`}>{r.refund}</span>
            </div>
          ))}
        </div>

        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--text-primary)]">How to Cancel</h2>
          <p>Go to the Trips tab, find your booking, and tap Cancel. Eligible refunds are processed via M-Pesa within 3–5 business days.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--text-primary)]">Owner Cancellations</h2>
          <p>If an owner cancels your booking for any reason, you will receive a full 100% refund regardless of timing.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-[var(--text-primary)]">Platform Fees</h2>
          <p>The KES 300 convenience fee is non-refundable. The 2% tourism levy is refunded proportionally with the booking amount.</p>
        </section>

        <p className="text-xs">Last updated: January 2025</p>
      </div>
    ),
  },
};

export default function Legal({ page }: { page: "terms" | "privacy" | "cancellation" }) {
  const navigate = useNavigate();
  const { title, body } = CONTENT[page];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      <div className="sticky top-0 z-40 flex items-center gap-3 px-4 py-4 bg-[var(--bg-surface)] border-b border-[var(--border)]">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-[var(--bg-primary)] flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-semibold text-[var(--text-primary)]">{title}</h1>
      </div>
      <div className="px-5 pt-5 max-w-lg mx-auto">
        {body}
      </div>
    </div>
  );
}
