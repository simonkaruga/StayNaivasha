import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Me {
  user_id: string;
  role: string;
  phone?: string;
}

async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) throw new Error("Not logged in");
  return res.json();
}

export default function Profile() {
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: fetchMe, retry: false });

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function requestOTP() {
    if (!phone) return;
    setSending(true); setError("");
    const res = await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setSending(false);
    if (res.ok) { setStep("otp"); }
    else { setError("Failed to send OTP — check your number"); }
  }

  async function verifyOTP() {
    if (!otp) return;
    setSending(true); setError("");
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone, code: otp }),
    });
    setSending(false);
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } else {
      setError("Incorrect code — try again");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    queryClient.invalidateQueries({ queryKey: ["me"] });
  }

  if (isLoading) return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--color-mint)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Logged in ──
  if (me) return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-20 px-4 pt-8">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-[var(--bg-surface)] rounded-2xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--color-forest)] flex items-center justify-center text-white text-xl font-semibold">
            {me.role[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-[var(--text-primary)] capitalize">{me.role}</p>
            <p className="text-sm text-[var(--text-muted)]">{me.phone ?? me.user_id.slice(0, 8)}</p>
          </div>
        </div>

        {me.role === "owner" && (
          <a href="/owner" className="block bg-[var(--color-forest)] text-white text-center text-sm font-medium py-3.5 rounded-2xl">
            Go to Owner Dashboard
          </a>
        )}

        <button
          onClick={logout}
          className="w-full border border-[var(--border)] text-[var(--text-muted)] text-sm py-3.5 rounded-2xl"
        >
          Log out
        </button>
      </div>
    </div>
  );

  // ── Login form ──
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 pb-20">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-display italic text-3xl text-[var(--text-primary)]">Welcome back</h1>
          <p className="text-[var(--text-muted)] text-sm">Sign in with your Kenyan phone number</p>
        </div>

        {step === "phone" ? (
          <div className="space-y-3">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+254712345678"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl px-4 py-3.5 outline-none text-sm"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              onClick={requestOTP}
              disabled={sending || !phone}
              className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-semibold py-3.5 rounded-2xl text-sm"
            >
              {sending ? "Sending code…" : "Send OTP"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)] text-center">
              Enter the 6-digit code sent to {phone}
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl px-4 py-3.5 outline-none text-sm text-center tracking-[0.5em] font-mono"
            />
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            <button
              onClick={verifyOTP}
              disabled={sending || otp.length < 6}
              className="w-full bg-[var(--color-forest)] disabled:bg-gray-300 text-white font-semibold py-3.5 rounded-2xl text-sm"
            >
              {sending ? "Verifying…" : "Verify & sign in"}
            </button>
            <button onClick={() => setStep("phone")} className="w-full text-[var(--text-muted)] text-xs underline">
              Change number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
