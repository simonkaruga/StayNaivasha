import { useState, useEffect } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { LayoutDashboard, ListChecks, Briefcase, UserCircle, ChevronRight } from "lucide-react";
import AgentApply from "./AgentApply";
import AgentDashboard from "./AgentDashboard";
import AgentReferrals from "./AgentReferrals";
import AgentProfile from "./AgentProfile";

const TABS = [
  { to: "/agent/dashboard",  label: "Dashboard",  Icon: LayoutDashboard },
  { to: "/agent/referrals",  label: "Referrals",  Icon: ListChecks },
  { to: "/agent/properties", label: "Properties", Icon: Briefcase },
  { to: "/agent/profile",    label: "Profile",    Icon: UserCircle },
];

export default function AgentLayout() {
  return (
    <div className="min-h-screen bg-[#fef6e8] flex flex-col">
      {/* Top bar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 border-b border-black/5"
        style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: "linear-gradient(135deg, #1e4a22, #186878)" }}
          >
            SN
          </span>
          <span className="font-semibold text-[#1a1008] text-sm">Agent Portal</span>
          <span className="ml-1 px-1.5 py-0.5 rounded text-[13px] font-bold text-white"
            style={{ background: "#d4892a" }}>
            AGENT
          </span>
        </div>
        <a
          href="/"
          className="text-xs text-[#186878] flex items-center gap-0.5"
        >
          Guest view <ChevronRight size={12} />
        </a>
      </header>

      {/* Page content */}
      <main className="flex-1 pt-20 pb-20">
        <Routes>
          <Route path="/"           element={<AgentDashboard />} />
          <Route path="/apply"      element={<AgentApply />} />
          <Route path="/dashboard"  element={<AgentDashboard />} />
          <Route path="/referrals"  element={<AgentReferrals />} />
          <Route path="/properties" element={<AgentProperties />} />
          <Route path="/profile"    element={<AgentProfile />} />
        </Routes>
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/5 flex"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(16px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                isActive ? "text-[#1e4a22]" : "text-[#1a1008]/40"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="relative flex items-center justify-center w-10 h-7 rounded-full transition-colors"
                  style={isActive ? { background: "rgba(30,74,34,0.08)" } : {}}
                >
                  <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                </span>
                <span className="text-[13px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

// Inline property browser (simple list from /api/properties)
function AgentProperties() {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-[#1a1008] mb-1">Browse Properties</h2>
      <p className="text-sm text-[#1a1008]/60 mb-4">
        Share your referral link with clients. You earn commission on every booking.
      </p>
      <AgentPropertyList />
    </div>
  );
}

function AgentPropertyList() {
  const [props, setProps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/properties?limit=50")
      .then(r => r.json())
      .then(d => { setProps(d.properties ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-[#1a1008]/40 text-sm">Loading...</div>;
  if (!props.length) return <div className="text-center py-12 text-[#1a1008]/40 text-sm">No properties yet.</div>;

  return (
    <div className="flex flex-col gap-3">
      {props.map((p: any) => (
        <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {p.primary_image && (
            <img src={p.primary_image} alt={p.title} className="w-full h-36 object-cover" />
          )}
          <div className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#1a1008] text-sm">{p.title}</p>
                <p className="text-xs text-[#1a1008]/50 mt-0.5">KES {(p.price_per_night ?? 0).toLocaleString()} / night</p>
              </div>
              <button
                onClick={() => {
                  const link = `${window.location.origin}/property/${p.id}?ref=agent`;
                  navigator.clipboard.writeText(link);
                }}
                className="shrink-0 text-xs text-white px-3 py-1.5 rounded-full font-medium"
                style={{ background: "linear-gradient(135deg, #1e4a22, #186878)" }}
              >
                Copy link
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

