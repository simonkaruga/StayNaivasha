import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 pb-24 text-center space-y-5">
      <div className="text-6xl">🏡</div>
      <div>
        <h1 className="font-display italic text-3xl text-[var(--text-primary)] mb-2">Lost in Naivasha?</h1>
        <p className="text-[var(--text-muted)] text-sm max-w-xs">
          This page doesn't exist. The lake is still beautiful though.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={() => navigate("/")}
          className="w-full bg-[var(--color-forest)] text-white font-bold py-3.5 rounded-2xl text-sm">
          Back to home
        </button>
        <button onClick={() => navigate(-1)}
          className="w-full border border-[var(--border)] text-[var(--text-muted)] py-3.5 rounded-2xl text-sm font-medium">
          Go back
        </button>
      </div>
    </div>
  );
}
