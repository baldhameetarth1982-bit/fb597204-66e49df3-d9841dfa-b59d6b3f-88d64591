import { Link, useRouterState } from "@tanstack/react-router";
import { FilePlus2, ListChecks, LayoutTemplate, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Unified Billing Center tab bar for Society Admin.
 * Groups the 4 billing surfaces: Generate / History / Templates / Settings.
 * Preserves existing routes — nothing is deleted.
 */
const TABS: Array<{ to: string; label: string; icon: any; exact?: boolean }> = [
  { to: "/society/billing", label: "History", icon: ListChecks, exact: true },
  { to: "/society/bill-studio", label: "Templates", icon: LayoutTemplate },
  { to: "/society/billing-settings", label: "Settings", icon: SlidersHorizontal },
];

export function BillingCenterTabs({
  onGenerate,
}: {
  /** When provided, shows a Generate pseudo-tab that triggers the parent dialog. */
  onGenerate?: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="-mx-4 mb-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <nav className="flex min-w-max gap-1 sm:gap-2" aria-label="Billing sections">
        {onGenerate && (
          <button
            onClick={onGenerate}
            className="inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <FilePlus2 className="h-4 w-4" />
            Generate
          </button>
        )}
        {TABS.map((t) => {
          const active = t.exact ? path === t.to : path.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to as any}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
