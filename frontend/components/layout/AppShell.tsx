"use client";

import type { ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { AdminTopBarActions } from "../admin/AdminTopBarActions";
import { MobileNav } from "./MobileNav";
import {
  getActiveNavItem,
  getClientPortalBaseHref,
  getNavigationRole,
} from "./MainNav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();
  const role = getNavigationRole(pathname);
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_API !== "false";

  if (!role) {
    return <>{children}</>;
  }

  const activeNavItem = getActiveNavItem(pathname);
  const isClientDashboardPath = /^\/c\/[A-Za-z0-9]+$/.test(pathname);
  const title =
    pathname === "/admin"
      ? "Dashboard admin"
      : pathname.startsWith("/admin/clients/")
        ? "Cliente"
      : isClientDashboardPath
        ? "Dashboard"
        : activeNavItem?.label ?? (role === "admin" ? "Admin" : "Cliente");
  const actions = role === "admin" ? <AdminTopBarActions /> : undefined;
  const showUtilityButtons = false;
  const clientPortalBaseHref =
    role === "client" ? getClientPortalBaseHref(pathname) : null;
  const logoHref =
    isSignedIn === false
      ? "/login"
      : role === "admin"
        ? "/admin"
      : role === "client"
          ? clientPortalBaseHref ?? "/login"
          : "/login";
  const accountHref =
    role === "client"
      ? clientPortalBaseHref
        ? `${clientPortalBaseHref}/account`
        : "/account"
      : "/account";
  const currentLabel = activeNavItem?.label ?? title;
  const eyebrow = role === "admin" ? "Sendwise admin" : "Sendwise cliente";

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Barra laterale Sendwise">
        <Sidebar
          accountHref={accountHref}
          role={role}
          isMockMode={isMockMode}
          logoHref={logoHref}
        />
      </aside>
      <div className="app-frame">
        <TopBar
          eyebrow={eyebrow}
          title={title}
          actions={actions}
          leading={
            <MobileNav
              accountHref={accountHref}
              currentLabel={currentLabel}
              pageTitle={title}
              role={role}
              isMockMode={isMockMode}
            />
          }
          isMockMode={isMockMode}
          showUtilityButtons={showUtilityButtons}
        />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
