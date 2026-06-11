import { Leaf, Gem, Home, Building2, Briefcase, Tent } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  cottage:   Leaf,
  villa:     Gem,
  house:     Home,
  apartment: Building2,
  conference: Briefcase,
  campsite:  Tent,
};

export default function TypeIcon({ type, className = "w-3 h-3" }: { type: string; className?: string }) {
  const Icon = MAP[type] ?? Home;
  return <Icon className={className} />;
}
