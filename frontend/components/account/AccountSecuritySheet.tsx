"use client";

import { UserProfile } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { KeyRound, Mail, ShieldCheck, Smartphone } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type AccountSecuritySheetMode = "email" | "password" | "mfa" | "sessions";

interface AccountSecuritySheetProps {
  mode: AccountSecuritySheetMode | null;
  onOpenChange: (mode: AccountSecuritySheetMode | null) => void;
}

const SHEET_COPY = {
  email: {
    clerkPage: "account" as const,
    description:
      "L'indirizzo email e la verifica dell'identita restano gestiti da Clerk dentro il flusso protetto Sendwise.",
    eyebrow: "Sicurezza account",
    focusTerms: ["email address", "email addresses", "indirizzo email", "indirizzi email"],
    helper:
      "Questa sezione resta dentro Sendwise e usa Clerk solo per email, verifica e identita.",
    title: "Gestisci email",
    Icon: Mail,
  },
  password: {
    clerkPage: "security" as const,
    description:
      "Password e credenziali sensibili restano gestite da Clerk. Sendwise non salva password.",
    eyebrow: "Sicurezza account",
    focusTerms: ["password"],
    helper:
      "Apri il pannello protetto per aggiornare la password senza uscire dall'area account.",
    title: "Password",
    Icon: KeyRound,
  },
  mfa: {
    clerkPage: "security" as const,
    description:
      "Autenticazione a due fattori e codici di recupero restano in capo a Clerk.",
    eyebrow: "Sicurezza account",
    focusTerms: [
      "two-step verification",
      "two-factor",
      "authenticator",
      "backup codes",
      "recovery codes",
      "codici di recupero",
    ],
    helper:
      "Usa questo pannello per attivare MFA o aggiornare i metodi di recupero disponibili.",
    title: "Autenticazione a due fattori",
    Icon: ShieldCheck,
  },
  sessions: {
    clerkPage: "security" as const,
    description:
      "Sessioni attive e dispositivi recenti restano visibili nel pannello sicurezza di Clerk.",
    eyebrow: "Sessione",
    focusTerms: ["active devices", "devices", "sessions", "sessioni", "dispositivi"],
    helper:
      "Controlla da qui i dispositivi collegati e le sessioni protette ancora aperte.",
    title: "Sessioni e dispositivi",
    Icon: Smartphone,
  },
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findFocusTarget(root: HTMLElement, focusTerms: string[]): HTMLElement | null {
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

export function AccountSecuritySheet({
  mode,
  onOpenChange,
}: AccountSecuritySheetProps) {
  const isOpen = mode !== null;
  const copy = mode ? SHEET_COPY[mode] : null;
  const clerkContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !copy || !clerkContainerRef.current) {
      return undefined;
    }

    const root = clerkContainerRef.current;
    let animationFrame = 0;
    let observer: MutationObserver | null = null;

    const focusTarget = () => {
      const target = findFocusTarget(root, copy.focusTerms);

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
    observer = new MutationObserver(scheduleFocus);
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
                  <SheetTitle className="account-sheet__title">{copy.title}</SheetTitle>
                  <SheetDescription className="account-sheet__description">
                    {copy.description}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="account-sheet__body">
              <div className="account-sheet__clerk-shell" ref={clerkContainerRef}>
                <p className="account-sheet__helper">{copy.helper}</p>
                <UserProfile
                  key={mode}
                  routing="hash"
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      card: "w-full border border-slate-200 bg-white shadow-none",
                      navbar: "hidden",
                      pageScrollBox: "p-0",
                      scrollBox: "p-0",
                      headerTitle: "text-slate-950",
                      headerSubtitle: "text-slate-500",
                      profileSectionTitleText: "text-slate-950",
                      profileSectionSubtitleText: "text-slate-500",
                      formButtonPrimary:
                        "bg-sky-600 hover:bg-sky-700 text-white shadow-none",
                      formFieldInput:
                        "border-slate-200 focus:border-sky-400 focus:ring-sky-200",
                      badge: "bg-sky-50 text-sky-700",
                    },
                  }}
                  fallback={
                    <div className="account-sheet__loading">
                      Caricamento impostazioni protette...
                    </div>
                  }
                >
                  <UserProfile.Page label={copy.clerkPage} />
                </UserProfile>
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
