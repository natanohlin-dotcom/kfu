import { can, type Permission } from "@/lib/auth/permissions";

/**
 * Modulregistret (PLAN.md §4): en rad per funktion. Styr sidomenyn, behörigheter
 * och vilka widgets som visas på översikten. Ny modul = ny mapp under app/admin/(app)/ + en rad här.
 */

export type ModuleGroup = "Start" | "Portfölj" | "Arbete" | "Verktyg" | "System";

/** Ikonnamn som sträng (serialiserbart till klienten, mall §9). Mappas i components/shell/icons.ts. */
export type IconName =
  | "layout-dashboard"
  | "briefcase"
  | "arrow-left-right"
  | "eye"
  | "file-text"
  | "calculator"
  | "building"
  | "file-output"
  | "settings";

export type WidgetId = "watchlist-movers" | "active-analyses" | "activity";

export type ModuleDef = {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  group: ModuleGroup;
  permission: Permission;
  /** Widgets som modulen bidrar med på översikten, i ordning */
  widgets?: WidgetId[];
  /** false = visas som "Snart" i menyn (planerad men inte byggd) */
  enabled: boolean;
  /** Fas i PLAN.md §12 där modulen byggs */
  phase: number;
};

export const MODULES: ModuleDef[] = [
  { id: "oversikt", label: "Översikt", href: "/admin/oversikt", icon: "layout-dashboard", group: "Start", permission: "dashboard:read", enabled: true, phase: 1 },
  { id: "portfolj", label: "Innehav", href: "/admin/portfolj", icon: "briefcase", group: "Portfölj", permission: "portfolio:read", enabled: false, phase: 3 },
  { id: "transaktioner", label: "Transaktioner", href: "/admin/portfolj/transaktioner", icon: "arrow-left-right", group: "Portfölj", permission: "portfolio:read", enabled: false, phase: 3 },
  { id: "bevakningar", label: "Bevakningar", href: "/admin/bevakningar", icon: "eye", group: "Arbete", permission: "watchlist:read", widgets: ["watchlist-movers"], enabled: false, phase: 4 },
  { id: "analyser", label: "Analyser", href: "/admin/analyser", icon: "file-text", group: "Arbete", permission: "analyses:read", widgets: ["active-analyses"], enabled: false, phase: 6 },
  { id: "dcf", label: "DCF-modell", href: "/admin/verktyg/dcf", icon: "calculator", group: "Verktyg", permission: "tools:use", enabled: false, phase: 5 },
  { id: "bolagsdata", label: "Bolagsdata", href: "/admin/verktyg/bolagsdata", icon: "building", group: "Verktyg", permission: "tools:use", enabled: false, phase: 5 },
  { id: "rapporter", label: "Rapporter", href: "/admin/rapporter", icon: "file-output", group: "Verktyg", permission: "reports:read", enabled: false, phase: 7 },
  { id: "installningar", label: "Inställningar", href: "/admin/installningar", icon: "settings", group: "System", permission: "dashboard:read", widgets: ["activity"], enabled: true, phase: 1 },
];

export const GROUP_ORDER: ModuleGroup[] = ["Start", "Portfölj", "Arbete", "Verktyg", "System"];

/** Det klienten behöver för menyn (bara serialiserbara fält). */
export type NavModule = Pick<ModuleDef, "id" | "label" | "href" | "icon" | "group" | "enabled" | "phase">;

export function navModulesFor(user: { role: import("@/lib/auth/permissions").Role }): NavModule[] {
  return MODULES.filter((m) => can(user, m.permission)).map(({ id, label, href, icon, group, enabled, phase }) => ({
    id, label, href, icon, group, enabled, phase,
  }));
}

/** Widgets för översikten från de moduler användaren har tillgång till. */
export function dashboardWidgetsFor(user: { role: import("@/lib/auth/permissions").Role }): { widget: WidgetId; module: ModuleDef }[] {
  return MODULES.filter((m) => can(user, m.permission)).flatMap((m) => (m.widgets ?? []).map((widget) => ({ widget, module: m })));
}
