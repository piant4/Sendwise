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
  { href: "/client", label: "Panoramica", icon: LayoutGrid },
  { href: "/client/campaigns", label: "Campagne", icon: Megaphone },
  { href: "/client/email-limits", label: "Limiti email", icon: Gauge },
  { href: "/client/blocked-sends", label: "Invii bloccati", icon: ShieldAlert },
];

export function getNavigationRole(pathname: string): AppRole | null {
  if (pathname.startsWith("/admin")) {
    return "admin";
  }

  if (pathname.startsWith("/client")) {
    return "client";
  }

  return null;
}

export function getNavItems(role: AppRole): NavItem[] {
  return role === "admin" ? ADMIN_NAV_ITEMS : CLIENT_NAV_ITEMS;
}

export function isNavItemActive(pathname: string, href: string) {
  if (pathname === href) {
    return true;
  }

  if (href === "/admin" || href === "/client") {
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
    getNavItems(role).find((item) => isNavItemActive(pathname, item.href)) ??
    getNavItems(role)[0]
  );
}

interface MainNavProps {
  role: AppRole;
  onNavigate?: () => void;
  className?: string;
}

export function MainNav({ role, onNavigate, className }: MainNavProps) {
  const pathname = usePathname();
  const navItems = getNavItems(role);

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
