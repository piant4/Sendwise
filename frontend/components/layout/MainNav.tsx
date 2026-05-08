"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Gauge,
  LayoutGrid,
  Megaphone,
  ServerCog,
  ShieldAlert,
  Users,
} from "lucide-react";

export type AppRole = "admin" | "client";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Panoramica", icon: LayoutGrid },
  { href: "/admin/clients", label: "Clienti", icon: Users },
  { href: "/admin/campaigns", label: "Campagne", icon: Megaphone },
  { href: "/admin/email-limits", label: "Limiti email", icon: Gauge },
  { href: "/admin/blocked-sends", label: "Invii bloccati", icon: ShieldAlert },
  { href: "/admin/system", label: "Sistema", icon: ServerCog },
];

export const CLIENT_NAV_ITEMS: NavItem[] = [
  { href: "/auth/redirect", label: "Panoramica", icon: LayoutGrid },
  { href: "/client/campaigns", label: "Campagne", icon: Megaphone },
  { href: "/client/email-limits", label: "Limiti email", icon: Gauge },
  { href: "/client/blocked-sends", label: "Invii bloccati", icon: ShieldAlert },
];

export function getNavigationRole(pathname: string): AppRole | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "admin";
  }

  if (
    pathname === "/client" ||
    pathname.startsWith("/client/") ||
    pathname === "/c" ||
    pathname.startsWith("/c/")
  ) {
    return "client";
  }

  return null;
}

function getClientDashboardHref(pathname: string): string {
  const portalSlugMatch = pathname.match(/^\/c\/([A-Za-z0-9]+)(?:\/|$)/);

  if (!portalSlugMatch) {
    return "/auth/redirect";
  }

  return `/c/${portalSlugMatch[1]}`;
}

export function getNavItems(role: AppRole, pathname: string): NavItem[] {
  if (role === "admin") {
    return ADMIN_NAV_ITEMS;
  }

  return CLIENT_NAV_ITEMS.map((item, index) =>
    index === 0 ? { ...item, href: getClientDashboardHref(pathname) } : item,
  );
}

export function isNavItemActive(pathname: string, href: string) {
  if (pathname === href) {
    return true;
  }

  if (href === "/admin" || href === "/auth/redirect") {
    return false;
  }

  return pathname.startsWith(`${href}/`) || pathname === href;
}

export function getActiveNavItem(pathname: string) {
  const role = getNavigationRole(pathname);

  if (!role) {
    return null;
  }

  return (
    getNavItems(role, pathname).find((item) => isNavItemActive(pathname, item.href)) ??
    getNavItems(role, pathname)[0]
  );
}

interface MainNavProps {
  role: AppRole;
  onNavigate?: () => void;
  className?: string;
}

export function MainNav({ role, onNavigate, className }: MainNavProps) {
  const pathname = usePathname();
  const navItems = getNavItems(role, pathname);

  if (navItems.length === 0) {
    return null;
  }

  return (
    <nav
      className={["main-nav", className].filter(Boolean).join(" ")}
      aria-label="Navigazione principale Sendwise"
    >
      <ul className="main-nav__list">
        {navItems.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="main-nav__link"
                data-active={active}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <Icon className="main-nav__icon" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
