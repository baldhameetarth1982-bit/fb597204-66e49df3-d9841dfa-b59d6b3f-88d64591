import type { ReactNode } from "react";

/** Clean centered layout for login/signup. UI shell only. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
