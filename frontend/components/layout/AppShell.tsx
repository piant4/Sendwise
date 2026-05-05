import type { ReactNode } from "react";
import { MainNav } from "./MainNav";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="brand-kicker">Sendwise</p>
          <p className="brand-title">AI email operations</p>
        </div>
        <MainNav />
      </header>
      {children}
    </div>
  );
}
