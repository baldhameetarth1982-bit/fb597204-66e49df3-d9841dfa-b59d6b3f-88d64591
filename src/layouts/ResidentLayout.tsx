import type { ReactNode } from "react";

/** Mobile-first resident shell with bottom nav slot (desktop falls back to top). */
export function ResidentLayout({
  topbar,
  bottomNav,
  children,
}: {
  topbar?: ReactNode;
  bottomNav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="h-14 border-b border-border flex items-center px-4">
        {topbar}
      </header>
      <main className="flex-1 p-4 pb-24 md:pb-4 overflow-auto">{children}</main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 border-t border-border bg-background">
        {bottomNav}
      </nav>
    </div>
  );
}
