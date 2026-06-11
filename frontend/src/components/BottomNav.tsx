import { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";

const tabs = [
  {
    to: "/",
    label: "Explore",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" fill={active ? "var(--bg-surface)" : "none"} stroke="currentColor" strokeWidth={2} />
      </svg>
    ),
  },
  {
    to: "/search",
    label: "Search",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="11" cy="11" r="8" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  {
    to: "/saved",
    label: "Saved",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? "#ef4444" : "none"} stroke={active ? "#ef4444" : "currentColor"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
  {
    to: "/bookings",
    label: "Trips",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth={active ? 2.5 : 2} fill="none" />
      </svg>
    ),
  },
  {
    to: "/profile",
    label: "Profile",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="8" r="4" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
] as const;

export default function BottomNav() {
  const [visible, setVisible] = useState(true);
  const lastY   = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (y < 12)                      setVisible(true);
      else if (y > lastY.current + 6)  setVisible(false);
      else if (y < lastY.current - 6)  setVisible(true);
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-label="Main navigation"
      style={{
        transform:  `translateY(${visible ? 0 : -64}px)`,
        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
      }}
      className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center px-4 border-b border-[var(--border)] bg-white shadow-sm"
    >
      {/* Brand */}
      <NavLink to="/" className="flex items-center mr-auto pl-1 flex-shrink-0">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black"
          style={{ background: "linear-gradient(135deg, #1e4a22 0%, #2a6030 60%, #b8722a 100%)", boxShadow: "0 2px 8px rgba(30,74,34,0.35)" }}>
          SN
        </span>
      </NavLink>

      {/* Tabs */}
      {tabs.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          aria-label={label}
          className={({ isActive }) =>
            `relative flex min-w-[44px] min-h-[44px] flex-col items-center justify-center gap-0.5 px-2 rounded-xl transition-colors ${
              isActive ? "text-[var(--color-forest)]" : "text-[var(--text-muted)]"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute inset-0 bg-[var(--color-forest)]/6 rounded-xl" aria-hidden="true" />
              )}
              <span className="relative z-10">{icon(isActive)}</span>
              <span className={`text-[10px] leading-none relative z-10 ${isActive ? "font-bold" : "font-medium"}`}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
