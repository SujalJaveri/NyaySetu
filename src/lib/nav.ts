import {
  LayoutDashboard,
  Folder,
  Gavel,
  DoorOpen,
  CalendarDays,
  CalendarPlus,
  TriangleAlert,
  FlaskConical,
  TrendingDown,
  FileBarChart,
  ScrollText,
  ShieldCheck,
  Gavel as GavelIcon,
  ListOrdered,
  SlidersHorizontal,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

/** Bench (judge) accounts get a single, self-scoped, read-only workspace. */
export const benchNavSections: { label: string; items: NavItem[] }[] = [
  {
    label: "My bench",
    items: [{ title: "My Bench", to: "/bench", icon: GavelIcon }],
  },
];

export const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { title: "Cases", to: "/cases", icon: Folder },
      { title: "Judges", to: "/judges", icon: Gavel },
      { title: "Courtrooms", to: "/courtrooms", icon: DoorOpen },
      { title: "Calendar", to: "/calendar", icon: CalendarDays },
      { title: "Cause List", to: "/cause-list", icon: ListOrdered },
    ],
  },
  {
    label: "Scheduling",
    items: [
      { title: "Smart Scheduling", to: "/smart-scheduling", icon: CalendarPlus },
      { title: "Conflict Detection", to: "/conflicts", icon: TriangleAlert },
      { title: "What-If Simulation", to: "/what-if-simulation", icon: FlaskConical },
      { title: "Backlog Simulator", to: "/backlog-simulator", icon: TrendingDown },
      { title: "Reports", to: "/reports", icon: FileBarChart },
      { title: "Activity Log", to: "/activity-log", icon: ScrollText },
      { title: "Governance & Compliance", to: "/governance", icon: ShieldCheck },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Admin Panel", to: "/admin", icon: UserCog, adminOnly: true },
      {
        title: "Priority Settings",
        to: "/priority-settings",
        icon: SlidersHorizontal,
        adminOnly: true,
      },
    ],
  },
];
