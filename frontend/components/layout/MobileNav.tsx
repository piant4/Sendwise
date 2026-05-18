"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandMark } from "../shared/BrandMark";
import { MockModeBadge } from "../shared/MockModeBadge";
import { SidebarAccountPanel } from "../shared/SidebarAccountPanel";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { MainNav, type AppRole } from "./MainNav";

interface MobileNavProps {
  role: AppRole;
  isMockMode: boolean;
}

export function MobileNav({ role, isMockMode }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Apri navigazione"
          className="mobile-nav-trigger"
        >
          <Menu aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent
        className="mobile-nav-sheet"
        side="left"
        showCloseButton={false}
      >
        <SheetHeader className="mobile-nav-sheet__header">
          <div className="mobile-nav-sheet__brand-row">
            <BrandMark size="md" />
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
          <SheetDescription className="sr-only">
            Menu laterale mobile con navigazione contestuale per admin o cliente.
          </SheetDescription>
        </SheetHeader>
        <div className="mobile-nav-content">
          <div className="sidebar-section">
            <p className="sidebar-label">
              {role === "admin" ? "Operazioni" : "Dashboard"}
            </p>
            <MainNav role={role} onNavigate={() => setOpen(false)} />
          </div>
          <div className="mobile-nav-account">
            <SidebarAccountPanel
              isMockMode={isMockMode}
              onAction={() => setOpen(false)}
            />
          </div>
          {isMockMode ? (
            <div className="mobile-nav-badge-row">
              <MockModeBadge />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
