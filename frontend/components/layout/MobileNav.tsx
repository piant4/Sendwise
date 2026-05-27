"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "../shared/BrandMark";
import { MockModeBadge } from "../shared/MockModeBadge";
import { SidebarAccountPanel } from "../shared/SidebarAccountPanel";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import {
  MainNav,
  getClientPortalBaseHref,
  getNavItems,
  type AppRole,
} from "./MainNav";

interface MobileNavProps {
  accountHref: string;
  currentLabel: string;
  pageTitle: string;
  role: AppRole;
  isMockMode: boolean;
}

export function MobileNav({
  accountHref,
  role,
  isMockMode,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const navId = role === "admin" ? "admin-mobile-navigation" : "client-mobile-navigation";
  const navItems = useMemo(() => getNavItems(role, pathname), [pathname, role]);
  const logoHref =
    role === "admin" ? "/admin" : getClientPortalBaseHref(pathname) ?? "/login";

  useEffect(() => {
    if (!open) {
      return;
    }

    for (const href of new Set([logoHref, accountHref, ...navItems.map((item) => item.href)])) {
      router.prefetch(href);
    }
  }, [accountHref, logoHref, navItems, open, router]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-controls={navId}
          aria-expanded={open}
          aria-label="Apri navigazione"
          className="mobile-nav-trigger"
        >
          <Menu aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent
        id={navId}
        className="mobile-nav-sheet"
        side="left"
        showCloseButton={false}
      >
        <div className="mobile-nav-sheet__header">
          <div className="mobile-nav-sheet__brand-row">
            <Link
              href={logoHref}
              className="mobile-nav-sheet__brand-link"
              prefetch
              onClick={() => setOpen(false)}
            >
              <BrandMark size="md" />
            </Link>
            <SheetClose asChild>
              <button
                type="button"
                className="mobile-nav-sheet__close"
                aria-label="Chiudi navigazione"
              >
                <X aria-hidden="true" />
              </button>
            </SheetClose>
          </div>
          <SheetTitle className="sr-only">Navigazione Sendwise</SheetTitle>
          <div className="mobile-nav-sheet__badge-row">
            {isMockMode ? <MockModeBadge /> : null}
          </div>
        </div>
        <div className="mobile-nav-content">
          <div className="mobile-nav-main">
            <MainNav
              className="main-nav--mobile"
              role={role}
              onNavigate={() => setOpen(false)}
            />
          </div>
          <div className="mobile-nav-account">
            <SidebarAccountPanel
              accountHref={accountHref}
              isMockMode={isMockMode}
              onAction={() => setOpen(false)}
              variant="mobile"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
