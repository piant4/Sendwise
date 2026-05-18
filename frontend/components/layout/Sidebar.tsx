import Link from "next/link";
import { BrandMark } from "../shared/BrandMark";
import { MockModeBadge } from "../shared/MockModeBadge";
import { SidebarAccountPanel } from "../shared/SidebarAccountPanel";
import { MainNav, type AppRole } from "./MainNav";

const ROLE_META: Record<
  AppRole,
  {
    sectionLabel: string;
  }
> = {
  admin: {
    sectionLabel: "Operazioni",
  },
  client: {
    sectionLabel: "Dashboard",
  },
};

interface SidebarProps {
  role: AppRole;
  isMockMode: boolean;
  logoHref: string;
}

export function Sidebar({ role, isMockMode, logoHref }: SidebarProps) {
  const meta = ROLE_META[role];

  return (
    <div className="sidebar-shell">
      <div className="sidebar-brand">
        <Link
          href={logoHref}
          className="sidebar-brand__link"
          aria-label="Vai alla dashboard"
        >
          <BrandMark size="lg" />
        </Link>
      </div>
      <div className="sidebar-section">
        <p className="sidebar-label">{meta.sectionLabel}</p>
        <MainNav role={role} />
      </div>
      <div className="sidebar-account">
        {isMockMode ? <MockModeBadge /> : null}
        <SidebarAccountPanel isMockMode={isMockMode} />
      </div>
    </div>
  );
}
