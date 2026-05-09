"use client";

import { UserProfile } from "@clerk/nextjs";
import {
  KeyRound,
  Mail,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AccountProfileNameForm } from "./AccountProfileNameForm";

export type AccountSettingsSheetMode =
  | "name"
  | "email"
  | "password"
  | "mfa"
  | "sessions";

interface AccountSettingsSheetProps {
  mode: AccountSettingsSheetMode | null;
  onOpenChange: (mode: AccountSettingsSheetMode | null) => void;
}

const SHEET_COPY = {
  name: {
    description: "Aggiorna nome e cognome direttamente in Clerk senza uscire da Sendwise.",
    eyebrow: "Profilo",
    kind: "custom" as const,
    title: "Modifica nome",
    Icon: UserRound,
  },
  email: {
    clerkPage: "account" as const,
    description: "Gestisci email principale e identita mantenendo Clerk come fonte di verita.",
    eyebrow: "Profilo",
    kind: "clerk" as const,
    startPath: "/account",
    title: "Gestisci email",
    Icon: Mail,
  },
  password: {
    clerkPage: "security" as const,
    description: "Aggiorna la password nel pannello sicurezza contenuto qui dentro.",
    eyebrow: "Sicurezza",
    kind: "clerk" as const,
    startPath: "/security",
    title: "Password",
    Icon: KeyRound,
  },
  mfa: {
    clerkPage: "security" as const,
    description: "Configura MFA e codici di recupero senza lasciare /account.",
    eyebrow: "Sicurezza",
    kind: "clerk" as const,
    startPath: "/security",
    title: "Autenticazione a due fattori",
    Icon: ShieldCheck,
  },
  sessions: {
    clerkPage: "security" as const,
    description: "Controlla sessioni e dispositivi recenti nel pannello sicurezza di Clerk.",
    eyebrow: "Sicurezza",
    kind: "clerk" as const,
    startPath: "/security",
    title: "Sessioni e dispositivi",
    Icon: Smartphone,
  },
};

export function AccountSettingsSheet({
  mode,
  onOpenChange,
}: AccountSettingsSheetProps) {
  const isOpen = mode !== null;
  const copy = mode ? SHEET_COPY[mode] : null;

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open ? mode : null);
      }}
    >
      <SheetContent className="account-sheet w-full sm:max-w-[640px]" side="right">
        {copy ? (
          <div className="account-sheet__panel">
            <SheetHeader className="account-sheet__header">
              <div className="account-sheet__eyebrow-row">
                <span className="account-sheet__eyebrow">{copy.eyebrow}</span>
              </div>
              <div className="account-sheet__title-row">
                <div className="account-sheet__icon" aria-hidden="true">
                  <copy.Icon />
                </div>
                <div className="account-sheet__copy">
                  <SheetTitle className="account-sheet__title">
                    {copy.title}
                  </SheetTitle>
                  <SheetDescription className="account-sheet__description">
                    {copy.description}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="account-sheet__body">
              {copy.kind === "custom" ? (
                <AccountProfileNameForm
                  onComplete={() => {
                    onOpenChange(null);
                  }}
                />
              ) : (
                <UserProfile
                  key={mode}
                  routing="hash"
                  fallback={
                    <div className="account-sheet__loading">
                      Caricamento impostazioni protette...
                    </div>
                  }
                  __experimental_startPath={copy.startPath}
                >
                  <UserProfile.Page label={copy.clerkPage} />
                </UserProfile>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
