"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";

const navItems = [
  { href: "/login", label: "Accesso" },
  { href: "/admin", label: "Admin" },
  { href: "/client", label: "Cliente" },
];

interface MainNavProps {
  onNavigate?: () => void;
}

export function MainNav({ onNavigate }: MainNavProps) {
  const pathname = usePathname();

  return (
    <nav className="main-nav" aria-label="Navigazione principale Sendwise">
      {navItems.map((item) => (
        <Button
          key={item.href}
          asChild
          className="main-nav__link"
          data-active={pathname === item.href}
          onClick={onNavigate}
          size="lg"
          variant={pathname === item.href ? "secondary" : "ghost"}
        >
          <Link
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            {item.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
