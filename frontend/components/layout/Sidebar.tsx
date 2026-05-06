import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { MainNav } from "./MainNav";

export function Sidebar() {
  return (
    <div className="sidebar-shell">
      <div className="sidebar-brand">
        <p className="brand-kicker">Sendwise</p>
        <p className="brand-title">Operazioni email AI</p>
      </div>
      <Badge className="mock-badge" variant="outline">
        Modalità mock: autenticazione frontend / dati simulati
      </Badge>
      <Separator />
      <div className="sidebar-section">
        <p className="sidebar-label">Navigazione</p>
        <MainNav />
      </div>
    </div>
  );
}
