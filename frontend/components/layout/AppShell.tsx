import type { ReactNode } from "react";
import { Badge } from "../ui/badge";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Barra laterale Sendwise">
        <Sidebar />
      </aside>
      <div className="app-frame">
        <header className="app-header">
          <div className="app-header__brand">
            <MobileNav />
            <div>
              <p className="brand-kicker">Sendwise</p>
              <p className="brand-title">Operazioni email AI</p>
            </div>
          </div>
          <Badge className="mock-badge" variant="outline">
            Modalità mock: autenticazione frontend / dati simulati
          </Badge>
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
