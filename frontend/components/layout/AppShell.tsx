"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminTopBarActions } from "../admin/AdminTopBarActions";
import { MobileNav } from "./MobileNav";
import {
  getActiveNavItem,
  getNavigationRole,
} from "./MainNav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const role = getNavigationRole(pathname);
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_API !== "false";

  if (!role) {
    return <>{children}</>;
  }

  const activeNavItem = getActiveNavItem(pathname);
  const title =
    pathname === "/admin"
      ? "Dashboard admin"
      : pathname === "/client"
        ? "Dashboard cliente"
        : activeNavItem?.label ?? (role === "admin" ? "Admin" : "Cliente");
  const actions = pathname === "/admin" ? <AdminTopBarActions /> : null;
  const showUtilityButtons = false;

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Barra laterale Sendwise">
        <Sidebar role={role} isMockMode={isMockMode} />
      </aside>
      <div className="app-frame">
        <TopBar
          title={title}
          actions={actions}
          leading={<MobileNav role={role} isMockMode={isMockMode} />}
          isMockMode={isMockMode}
          showUtilityButtons={showUtilityButtons}
        />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
