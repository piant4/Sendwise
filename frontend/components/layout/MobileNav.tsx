"use client";

import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { MainNav } from "./MainNav";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          aria-label="Apri navigazione"
          className="mobile-nav-trigger"
          size="icon-lg"
          variant="outline"
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent className="mobile-nav-sheet" side="left">
        <SheetHeader>
          <SheetTitle
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: 0,
            }}
          >
            Sendwise
          </SheetTitle>
          <SheetDescription className="sr-only">
            Navigazione principale per le route Sendwise.
          </SheetDescription>
        </SheetHeader>
        <div className="mobile-nav-content">
          <MainNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
