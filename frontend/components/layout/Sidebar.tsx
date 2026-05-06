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
    userName: string;
    userEmail: string;
  }
> = {
  admin: {
    workspaceName: "Sendwise Org",
    workspaceType: "Ambiente admin",
    workspaceInitials: "SW",
    sectionLabel: "Operazioni",
    userName: "Marta Bellini",
    userEmail: "marta@sendwise.local",
  },
  client: {
    workspaceName: "Acme Studio",
    workspaceType: "Workspace cliente",
    workspaceInitials: "AC",
    sectionLabel: "Dashboard",
    userName: "Lorenzo Conti",
    userEmail: "lorenzo@acmestudio.it",
  },
};

interface SidebarProps {
  role: AppRole;
}

export function Sidebar({ role }: SidebarProps) {
  const meta = ROLE_META[role];
  const userInitials = meta.userName
    .split(" ")
    .map((chunk) => chunk[0])
    .slice(0, 2)
    .join("");

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
        <div className="sidebar-account__identity">
          <div className="sidebar-account__avatar" aria-hidden="true">
            {userInitials}
          </div>
          <div className="sidebar-account__copy">
            <span>{meta.userName}</span>
            <span>{meta.userEmail}</span>
          </div>
        </div>
        <MockModeBadge />
      </div>
    </div>
  );
}
