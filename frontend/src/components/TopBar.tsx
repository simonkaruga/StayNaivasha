import { NavLink, useLocation } from "react-router-dom";
import { User } from "lucide-react";

export default function TopBar() {
  const { pathname } = useLocation();
  const onProfile = pathname === "/profile";

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex h-20 items-center px-4 border-b border-[var(--border)]"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <NavLink to="/" className="flex items-center gap-2 mr-auto" aria-label="StayNaivasha home">
        <img
          src="/logo.png"
          alt="StayNaivasha"
          className="object-contain flex-shrink-0"
          style={{ width: 68, height: 68 }}
        />
        <span
          className="font-display italic text-[var(--color-forest)] leading-none tracking-tight"
          style={{ fontSize: "2rem" }}
        >
          StayNaivasha
        </span>
      </NavLink>

      <NavLink
        to="/profile"
        aria-label="Profile"
        className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
          onProfile
            ? "border-[var(--color-forest)] text-[var(--color-forest)]"
            : "border-[var(--border)] text-[var(--text-muted)]"
        }`}
        style={onProfile ? { background: "rgba(30,74,34,0.08)" } : undefined}
      >
        <User className="w-[18px] h-[18px]" />
      </NavLink>
    </header>
  );
}
