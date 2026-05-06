"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
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
  const roleLabel = role === "admin" ? "Admin" : "Cliente";
  const breadcrumb =
    activeNavItem && activeNavItem.href !== `/${role}`
      ? ["Sendwise", roleLabel, activeNavItem.label]
      : ["Sendwise", roleLabel];

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Barra laterale Sendwise">
        <Sidebar role={role} isMockMode={isMockMode} />
      </aside>
      <div className="app-frame">
        <TopBar
          title={activeNavItem?.label ?? (role === "admin" ? "Admin" : "Cliente")}
          breadcrumb={breadcrumb}
          leading={<MobileNav role={role} isMockMode={isMockMode} />}
          isMockMode={isMockMode}
        />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
