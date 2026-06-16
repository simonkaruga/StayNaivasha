import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Clock, CheckCircle2, ChevronRight, Briefcase } from "lucide-react";

interface DashboardData {
  agency_name: string | null;
  commission_pct: number;
  total_bookings: number;
  total_earned: number;
  pending_payout: number;
  status: string;
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAgent, setNotAgent] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setNotAgent(true); setLoading(false); return; }
    fetch("/api/agent/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (r.status === 404 || r.status === 403) { setNotAgent(true); return; }
        setData(await r.json());
      })
      .catch(() => setNotAgent(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-[#1a1008]/40 text-sm">Loading...</div>;
  }

  if (notAgent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: "rgba(30,74,34,0.08)" }}>
          <Briefcase size={28} className="text-[#1e4a22]" />
        </div>
        <h2 className="text-xl font-bold text-[#1a1008] mb-2">Not yet an agent</h2>
        <p className="text-sm text-[#1a1008]/55 max-w-xs mb-6">
          Apply to become a StayNaivasha agent and earn 5% commission paid to M-Pesa on every referral.
        </p>
        <button
          onClick={() => navigate("/agent/apply")}
          className="text-white text-sm font-semibold px-6 py-3 rounded-full"
          style={{ background: "linear-gradient(135deg, #1e4a22, #186878)" }}
        >
          Apply now
        </button>
      </div>
    );
  }

  if (!data) return null;

  const isPending = data.status === "pending";

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#1a1008]">
          {data.agency_name ?? "Agent dashboard"}
        </h1>
        {isPending && (
          <div className="mt-2 flex items-center gap-2 bg-[#d4892a]/10 border border-[#d4892a]/20 rounded-xl px-3 py-2">
            <Clock size={14} className="text-[#d4892a] shrink-0" />
            <p className="text-xs text-[#d4892a] font-medium">Application under review — we'll WhatsApp you within 24h</p>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard
          label="Total earned"
          value={`KES ${data.total_earned.toLocaleString()}`}
          Icon={CheckCircle2}
          accent="#1e4a22"
        />
        <StatCard
          label="Pending payout"
          value={`KES ${data.pending_payout.toLocaleString()}`}
          Icon={Clock}
          accent="#d4892a"
        />
        <StatCard
          label="Referrals"
          value={String(data.total_bookings)}
          Icon={TrendingUp}
          accent="#186878"
        />
        <StatCard
          label="Commission rate"
          value={`${data.commission_pct}%`}
          Icon={Briefcase}
          accent="#3ec890"
        />
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
        <QuickAction
          label="View all referrals"
          desc="Track commissions per booking"
          onClick={() => navigate("/agent/referrals")}
        />
        <QuickAction
          label="Browse properties"
          desc="Copy your referral link for any property"
          onClick={() => navigate("/agent/properties")}
          last
        />
      </div>

      {/* How commission works */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <p className="text-xs font-semibold text-[#1e4a22] uppercase tracking-wide mb-3">How it works</p>
        {[
          ["1", "Copy a property link from the Properties tab"],
          ["2", "Share it with your client on WhatsApp or social media"],
          ["3", "They book and pay via M-Pesa — we track your referral"],
          ["4", "After check-in you receive M-Pesa payout within 24h"],
        ].map(([n, text]) => (
          <div key={n} className="flex gap-3 mb-2.5 last:mb-0">
            <span className="w-5 h-5 rounded-full text-white text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: "linear-gradient(135deg, #1e4a22, #186878)" }}>
              {n}
            </span>
            <p className="text-sm text-[#1a1008]/70">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, Icon, accent }: { label: string; value: string; Icon: any; accent: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
        style={{ background: `${accent}18` }}>
        <Icon size={16} style={{ color: accent }} />
      </div>
      <p className="text-lg font-bold text-[#1a1008] leading-none">{value}</p>
      <p className="text-xs text-[#1a1008]/50 mt-0.5">{label}</p>
    </div>
  );
}

function QuickAction({ label, desc, onClick, last }: { label: string; desc: string; onClick: () => void; last?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-[#fef6e8] ${!last ? "border-b border-black/5" : ""}`}
    >
      <div>
        <p className="text-sm font-semibold text-[#1a1008]">{label}</p>
        <p className="text-xs text-[#1a1008]/50">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-[#1a1008]/30" />
    </button>
  );
}
