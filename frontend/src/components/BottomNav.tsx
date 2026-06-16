import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

interface Me { role: string; }
async function fetchMe(): Promise<Me> {
  const r = await fetch("/api/auth/me", { credentials: "include" });
  if (!r.ok) throw new Error("unauth");
  return r.json();
}

// SVG icon helpers
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor"
      strokeWidth={active ? 0 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" fill={active ? "var(--bg-surface)" : "none"} stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}
function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <circle cx="11" cy="11" r="8" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
function SavedIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? "#ef4444" : "none"} stroke={active ? "#ef4444" : "currentColor"}
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}
function TripsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0}
      stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth={active ? 2.5 : 2} fill="none" />
    </svg>
  );
}
function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <rect x="3" y="3" width="7" height="8" rx="1.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
      <rect x="14" y="3" width="7" height="4" rx="1.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
      <rect x="14" y="11" width="7" height="10" rx="1.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
      <rect x="3" y="15" width="7" height="6" rx="1.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
    </svg>
  );
}
function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <circle cx="12" cy="8" r="4" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const guestTabs = [
  { to: "/",         label: "Explore",   Icon: HomeIcon    },
  { to: "/search",   label: "Search",    Icon: SearchIcon  },
  { to: "/saved",    label: "Saved",     Icon: SavedIcon   },
  { to: "/bookings", label: "Trips",     Icon: TripsIcon   },
  { to: "/profile",  label: "Profile",   Icon: ProfileIcon },
] as const;

const ownerTabs = [
  { to: "/",         label: "Explore",   Icon: HomeIcon      },
  { to: "/search",   label: "Search",    Icon: SearchIcon    },
  { to: "/owner",    label: "Dashboard", Icon: DashboardIcon },
  { to: "/bookings", label: "Trips",     Icon: TripsIcon     },
  { to: "/profile",  label: "Profile",   Icon: ProfileIcon   },
] as const;

export default function BottomNav() {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60_000,   // reuse cached me — no extra network calls
  });

  const tabs = me?.role === "owner" || me?.role === "admin" ? ownerTabs : guestTabs;

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (y < 40)                      setVisible(true);
      else if (y > lastY.current + 8)  setVisible(false);
      else if (y < lastY.current - 8)  setVisible(true);
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-label="Main navigation"
      style={{
        transform:  `translateY(${visible ? 0 : 80}px)`,
        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
      className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch border-t border-[var(--border)]"
    >
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/" || to === "/owner"}
          aria-label={label}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
              isActive ? "text-[var(--color-forest)]" : "text-[var(--text-muted)]"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-8 rounded-full"
                  style={{ background: "rgba(30,74,34,0.08)" }}
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10"><Icon active={isActive} /></span>
              <span className={`text-[13px] leading-none relative z-10 ${isActive ? "font-bold" : "font-medium"}`}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
