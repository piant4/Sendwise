"use client";

import { UserProfile } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
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
    shortcuts: ["name", "email"] as const,
    title: "Modifica nome",
    Icon: UserRound,
  },
  email: {
    clerkPage: "account" as const,
    description: "Gestisci email principale e identita mantenendo Clerk come fonte di verita.",
    eyebrow: "Profilo",
    focusTerms: ["email addresses", "email address", "indirizzi email", "indirizzo email"],
    helper: "La scheda sotto resta dentro /account e mette al centro la gestione email di Clerk.",
    kind: "clerk" as const,
    shortcuts: ["name", "email"] as const,
    title: "Gestisci email",
    Icon: Mail,
  },
  password: {
    clerkPage: "security" as const,
    description: "Aggiorna la password nel pannello sicurezza contenuto qui dentro.",
    eyebrow: "Sicurezza",
    focusTerms: ["password"],
    helper: "La scheda sicurezza viene aperta qui dentro e focalizza il blocco password.",
    kind: "clerk" as const,
    shortcuts: ["password", "mfa", "sessions"] as const,
    title: "Password",
    Icon: KeyRound,
  },
  mfa: {
    clerkPage: "security" as const,
    description: "Configura MFA e codici di recupero senza lasciare /account.",
    eyebrow: "Sicurezza",
    focusTerms: [
      "two-step verification",
      "two-factor",
      "mfa",
      "authenticator",
      "backup codes",
      "recovery codes",
      "codici di recupero",
    ],
    helper: "La scheda sicurezza resta contenuta e porta l'attenzione sulla configurazione MFA.",
    kind: "clerk" as const,
    shortcuts: ["password", "mfa", "sessions"] as const,
    title: "Autenticazione a due fattori",
    Icon: ShieldCheck,
  },
  sessions: {
    clerkPage: "security" as const,
    description: "Controlla sessioni e dispositivi recenti nel pannello sicurezza di Clerk.",
    eyebrow: "Sicurezza",
    focusTerms: ["active devices", "devices", "sessions", "sessioni", "dispositivi"],
    helper: "La scheda sicurezza resta dentro Sendwise e centra l'area sessioni e dispositivi.",
    kind: "clerk" as const,
    shortcuts: ["password", "mfa", "sessions"] as const,
    title: "Sessioni e dispositivi",
    Icon: Smartphone,
  },
};

function getShortcutLabel(mode: AccountSettingsSheetMode): string {
  switch (mode) {
    case "name":
      return "Nome";
    case "email":
      return "Email";
    case "password":
      return "Password";
    case "mfa":
      return "MFA";
    case "sessions":
      return "Sessioni";
    default:
      return mode;
  }
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findClerkFocusTarget(root: HTMLElement, focusTerms: string[]): HTMLElement | null {
  const terms = focusTerms.map(normalizeText);
  const elements = Array.from(
    root.querySelectorAll<HTMLElement>("button, a, h1, h2, h3, h4, h5, p, span"),
  );

  return (
    elements.find((element) => {
      const text = normalizeText(element.textContent ?? "");
      return text && terms.some((term) => text.includes(term));
    }) ?? null
  );
}

export function AccountSettingsSheet({
  mode,
  onOpenChange,
}: AccountSettingsSheetProps) {
  const isOpen = mode !== null;
  const copy = mode ? SHEET_COPY[mode] : null;
  const clerkContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !copy || copy.kind !== "clerk" || !clerkContainerRef.current) {
      return undefined;
    }

    const root = clerkContainerRef.current;
    let animationFrame = 0;
    let observer: MutationObserver | null = null;

    const focusTarget = () => {
      const target = findClerkFocusTarget(root, copy.focusTerms);

      if (!target) {
        return false;
      }

      target.scrollIntoView({ behavior: "smooth", block: "center" });

      if (
        target instanceof HTMLButtonElement ||
        target instanceof HTMLAnchorElement ||
        target instanceof HTMLInputElement
      ) {
        target.focus({ preventScroll: true });
      }

      target.classList.add("account-sheet__spotlight");
      window.setTimeout(() => {
        target.classList.remove("account-sheet__spotlight");
      }, 1800);
      return true;
    };

    const scheduleFocus = () => {
      animationFrame = window.requestAnimationFrame(() => {
        if (focusTarget() && observer) {
          observer.disconnect();
        }
      });
    };

    scheduleFocus();
    observer = new MutationObserver(() => {
      scheduleFocus();
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
    };
  }, [copy, isOpen]);

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
              <div className="account-sheet__shortcut-row" aria-label="Azioni account">
                {copy.shortcuts.map((shortcut) => (
                  <button
                    key={shortcut}
                    type="button"
                    className="account-sheet__shortcut"
                    data-active={mode === shortcut}
                    onClick={() => {
                      onOpenChange(shortcut);
                    }}
                  >
                    {getShortcutLabel(shortcut)}
                  </button>
                ))}
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
                <div className="account-sheet__clerk-shell" ref={clerkContainerRef}>
                  <p className="account-sheet__helper">{copy.helper}</p>
                  <UserProfile
                    key={mode}
                    routing="hash"
                    fallback={
                      <div className="account-sheet__loading">
                        Caricamento impostazioni protette...
                      </div>
                    }
                  >
                    <UserProfile.Page label={copy.clerkPage} />
                  </UserProfile>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
