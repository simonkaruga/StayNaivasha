import { useNavigate, Link } from "react-router-dom";
import { Smartphone, ShieldCheck, Home as HomeIcon, Leaf } from "lucide-react";
import { useSEO } from "../utils/seo";

export default function About() {
  const navigate = useNavigate();
  useSEO({
    title: "About StayNaivasha",
    description: "StayNaivasha is Kenya's first local-first vacation rental platform for Kenyan guests and property owners. Book verified holiday homes in Naivasha with M-Pesa.",
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
        <h1 className="font-semibold text-[var(--text-primary)]">About</h1>
      </div>

      <div className="max-w-lg mx-auto">

        {/* Hero banner */}
        <div className="relative overflow-hidden px-5 pt-10 pb-10"
          style={{ background: "linear-gradient(160deg, #1e4a22 0%, #2a5c28 45%, #6b3a10 80%, #3d2008 100%)" }}>
          <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full" style={{ background: "rgba(62,200,144,0.07)" }} />
          <p className="text-[var(--color-mint)] text-[13px] font-semibold tracking-[0.28em] uppercase mb-3 relative z-10">
            Naivasha · Kenya
          </p>
          <h2 className="font-display italic text-white relative z-10"
            style={{ fontSize: "clamp(2.4rem, 9vw, 3.2rem)", lineHeight: 0.92 }}>
            Built by a resident.<br />For residents<br />and visitors.
          </h2>
          <p className="text-white/55 text-sm mt-4 max-w-xs leading-relaxed relative z-10">
            StayNaivasha is Kenya's first local-first vacation rental platform — designed from the ground up for the
            Kenyan market, with M-Pesa at its core.
          </p>
        </div>

        <div className="px-5 pt-6 space-y-8">

          {/* Origin story */}
          <section className="space-y-3">
            <h3 className="font-semibold text-[var(--text-primary)]">Our story</h3>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Naivasha has world-class views, hippos, Hell's Gate, and some of the most beautiful
              short-stay homes in East Africa. But booking them was broken — scattered WhatsApp groups,
              no photos, no price transparency, no protection if something went wrong.
            </p>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              So we built what was missing. A platform where every home is verified, every booking is
              protected by M-Pesa escrow, and guests can book in 30 seconds without a credit card.
            </p>
          </section>

          {/* Values */}
          <section className="space-y-3">
            <h3 className="font-semibold text-[var(--text-primary)]">What we stand for</h3>
            <div className="space-y-3">
              {[
                { Icon: Smartphone,   color: "#186878", title: "Kenya first",             body: "KES only. M-Pesa only. No dollar conversions, no international card fees. Built for the 50M+ Kenyans with a smartphone." },
                { Icon: ShieldCheck,  color: "#1e4a22", title: "Guest protection always", body: "Your money never goes to a host until you physically check in. That's a promise, not a policy." },
                { Icon: HomeIcon,     color: "#d4892a", title: "Fair for owners too",     body: "Zero commission for 2 months. Flat fee after that. Payouts within 2 hours of check-in. Owners earn more here than anywhere else." },
                { Icon: Leaf,         color: "#3ec890", title: "Local community",         body: "Every property listed supports a local Naivasha family. We don't list chains or corporate-owned properties." },
              ].map(v => (
                <div key={v.title} className="flex gap-3 bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border)]">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${v.color}15` }}>
                    <v.Icon size={16} style={{ color: v.color }} />
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)] text-sm">{v.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{v.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* By the numbers */}
          <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h3 className="font-semibold text-[var(--text-primary)] text-sm">By the numbers</h3>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)]">
              {[
                { v: "~90 min", l: "From Nairobi via A104" },
                { v: "KES 300", l: "Flat fee per booking" },
                { v: "2 hrs",   l: "Host payout after check-in" },
                { v: "0%",      l: "Commission for 2 months" },
              ].map(s => (
                <div key={s.l} className="px-4 py-3">
                  <p className="font-bold text-lg text-[var(--text-primary)] leading-none">{s.v}</p>
                  <p className="text-[13px] text-[var(--text-muted)] mt-1">{s.l}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Contact */}
          <section className="space-y-3">
            <h3 className="font-semibold text-[var(--text-primary)]">Get in touch</h3>
            <a href="https://wa.me/254700000000" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border)] active:opacity-80">
              <span className="text-2xl">💬</span>
              <div>
                <p className="font-semibold text-[var(--text-primary)] text-sm">WhatsApp support</p>
                <p className="text-xs text-[var(--text-muted)]">We reply fast — usually within an hour</p>
              </div>
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-[var(--text-muted)] ml-auto" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </a>
            <a href="mailto:hello@staynaivasha.co.ke"
              className="flex items-center gap-3 bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border)] active:opacity-80">
              <span className="text-2xl">✉️</span>
              <div>
                <p className="font-semibold text-[var(--text-primary)] text-sm">Email us</p>
                <p className="text-xs text-[var(--text-muted)]">hello@staynaivasha.co.ke</p>
              </div>
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-[var(--text-muted)] ml-auto" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </a>
          </section>

          {/* Footer links */}
          <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
            {[
              { to: "/how-it-works",        label: "How it works" },
              { to: "/terms",               label: "Terms of service" },
              { to: "/privacy",             label: "Privacy policy" },
              { to: "/cancellation-policy", label: "Cancellation policy" },
              { to: "/owner",               label: "List your property" },
              { to: "/search",              label: "Browse homes" },
            ].map(l => (
              <Link key={l.to} to={l.to} className="underline underline-offset-2">{l.label}</Link>
            ))}
          </div>

          <div className="text-center pb-2 space-y-1">
            <p className="text-[13px] text-[var(--text-muted)]">
              © {new Date().getFullYear()} StayNaivasha
            </p>
            <p className="text-xs text-[var(--text-muted)]/70">
              Built by{" "}
              <span className="font-semibold text-[var(--color-forest)]">Avinaya Solutions Ltd</span>
              {" "}· Naivasha, Kenya
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
