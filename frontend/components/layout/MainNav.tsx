"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";

const adminNavItems = [
  { href: "/admin", label: "Panoramica" },
  { href: "/admin/clients", label: "Clienti" },
  { href: "/admin/campaigns", label: "Campagne" },
  { href: "/admin/email-limits", label: "Limiti email" },
  { href: "/admin/blocked-sends", label: "Invii bloccati" },
  { href: "/admin/system", label: "Sistema" },
];

const clientNavItems = [
  { href: "/client", label: "Panoramica" },
  { href: "/client/campaigns", label: "Campagne" },
  { href: "/client/email-limits", label: "Limiti email" },
  { href: "/client/blocked-sends", label: "Invii bloccati" },
];

interface MainNavProps {
  onNavigate?: () => void;
}

export function MainNav({ onNavigate }: MainNavProps) {
  const pathname = usePathname();
  const navItems = pathname.startsWith("/admin")
    ? adminNavItems
    : pathname.startsWith("/client")
      ? clientNavItems
      : [];

  if (navItems.length === 0) {
    return null;
  }

  return (
    <nav className="main-nav" aria-label="Navigazione principale Sendwise">
      <p className="sidebar-label">Navigazione</p>
      {navItems.map((item) => (
        <Button
          key={item.href}
          asChild
          className="main-nav__link"
          data-active={
            pathname === item.href ||
            (item.href !== "/admin" &&
              item.href !== "/client" &&
              pathname.startsWith(`${item.href}/`))
          }
          onClick={onNavigate}
          size="lg"
          variant={
            pathname === item.href ||
            (item.href !== "/admin" &&
              item.href !== "/client" &&
              pathname.startsWith(`${item.href}/`))
              ? "secondary"
              : "ghost"
          }
        >
          <Link
            href={item.href}
            aria-current={
              pathname === item.href ||
              (item.href !== "/admin" &&
                item.href !== "/client" &&
                pathname.startsWith(`${item.href}/`))
                ? "page"
                : undefined
            }
          >
            {item.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
