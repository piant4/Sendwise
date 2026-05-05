import type { ReactNode } from "react";
import { MainNav } from "./MainNav";
import { StatusBadge } from "../ui/StatusBadge";

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
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "flex-end",
          }}
        >
          <StatusBadge
            label="Mock mode: frontend-only auth / mock data"
            variant="warning"
          />
          <MainNav />
        </div>
      </header>
      {children}
    </div>
  );
}
