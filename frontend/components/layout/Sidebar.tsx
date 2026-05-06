import { Separator } from "../ui/separator";
import { MainNav } from "./MainNav";

export function Sidebar() {
  return (
    <div className="sidebar-shell">
      <div className="sidebar-brand">
        <p
          className="brand-title"
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: 0,
          }}
        >
          Sendwise
        </p>
      </div>
      <Separator />
      <MainNav />
    </div>
  );
}
