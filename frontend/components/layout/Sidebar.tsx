import { BrandMark } from "../shared/BrandMark";
import { MockModeBadge } from "../shared/MockModeBadge";
import { MainNav, type AppRole } from "./MainNav";

const ROLE_META: Record<
  AppRole,
  {
    workspaceName: string;
    workspaceType: string;
    workspaceInitials: string;
    sectionLabel: string;
  }
> = {
  admin: {
    workspaceName: "Sendwise Org",
    workspaceType: "Ambiente admin",
    workspaceInitials: "SW",
    sectionLabel: "Operazioni",
  },
  client: {
    workspaceName: "Acme Studio",
    workspaceType: "Workspace cliente",
    workspaceInitials: "AC",
    sectionLabel: "Dashboard",
  },
};

interface SidebarProps {
  role: AppRole;
  isMockMode: boolean;
}

export function Sidebar({ role, isMockMode }: SidebarProps) {
  const meta = ROLE_META[role];

  return (
    <div className="sidebar-shell">
      <div className="sidebar-brand">
        <BrandMark size="md" />
      </div>
      <div className="sidebar-workspace" aria-label="Contesto area corrente">
        <div className="sidebar-workspace__badge" aria-hidden="true">
          {meta.workspaceInitials}
        </div>
        <div className="sidebar-workspace__copy">
          <span>{meta.workspaceName}</span>
          <span>{meta.workspaceType}</span>
        </div>
      </div>
      <div className="sidebar-section">
        <p className="sidebar-label">{meta.sectionLabel}</p>
        <MainNav role={role} />
      </div>
      <div className="sidebar-account">
        <div className="sidebar-account__copy">
          <span>Sessione protetta</span>
          <span>Gestione account e sicurezza tramite Clerk.</span>
        </div>
        {isMockMode ? <MockModeBadge /> : null}
      </div>
    </div>
  );
}
