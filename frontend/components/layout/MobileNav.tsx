"use client";

import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { Badge } from "../ui/badge";
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
          <SheetTitle>Sendwise</SheetTitle>
          <SheetDescription>
            Autenticazione mock e dati simulati per lo sviluppo frontend.
          </SheetDescription>
        </SheetHeader>
        <div className="mobile-nav-content">
          <Badge className="mock-badge" variant="outline">
            Modalità mock: autenticazione frontend / dati simulati
          </Badge>
          <MainNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
