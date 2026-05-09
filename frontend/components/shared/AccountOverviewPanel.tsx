"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { ClerkSignOutButton } from "./ClerkSignOutButton";

function getAccountLabel(fullName: string | null | undefined, email: string) {
  if (fullName && fullName.trim().length > 0) {
    return fullName.trim();
  }

  return email || "Account";
}

function getAccountInitials(fullName: string | null | undefined, email: string) {
  const source =
    fullName && fullName.trim().length > 0 ? fullName : email || "Account";
  const parts = source
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

interface AccountOverviewPanelProps {
  accountContextLabel: string;
}

export function AccountOverviewPanel({
  accountContextLabel,
}: AccountOverviewPanelProps) {
  const { isLoaded, isSignedIn, user } = useUser();

  const email = user?.primaryEmailAddress?.emailAddress ?? "Nessuna email";
  const label = getAccountLabel(user?.fullName, email);
  const initials = getAccountInitials(user?.fullName, email);
  const securityHint = isLoaded && isSignedIn
    ? "Password, MFA e sessioni restano gestite in modo sicuro da Clerk."
    : "Caricamento delle impostazioni protette in corso.";

  return (
    <div className="account-stack">
      <section className="account-surface">
        <div className="account-surface__header">
          <span className="account-surface__badge">Centro account</span>
          <div className="account-surface__copy">
            <h2>Impostazioni essenziali</h2>
            <p>
              Gestisci il tuo accesso Sendwise con una UI piu pulita. Le operazioni
              sensibili continuano a essere eseguite tramite Clerk.
            </p>
          </div>
        </div>

        <div className="account-actions-grid">
          <article className="account-action-card account-action-card--identity">
            <div className="account-action-card__icon" aria-hidden="true">
              <UserRound />
            </div>
            <div className="account-action-card__body">
              <span className="account-action-card__eyebrow">Profilo</span>
              <h3>{isLoaded && isSignedIn ? label : "Caricamento account"}</h3>
              <p>{email}</p>
            </div>
            <div className="account-identity">
              <div className="account-identity__avatar" aria-hidden="true">
                {initials}
              </div>
              <div className="account-identity__meta">
                <span>Contesto</span>
                <strong>{accountContextLabel}</strong>
              </div>
            </div>
          </article>

          <article className="account-action-card">
            <div className="account-action-card__icon" aria-hidden="true">
              <Mail />
            </div>
            <div className="account-action-card__body">
              <span className="account-action-card__eyebrow">Email e accesso</span>
              <h3>Gestisci profilo ed email</h3>
              <p>
                Aggiorna i dati principali e i metodi di accesso collegati al tuo
                account.
              </p>
            </div>
            <Link href="/account/account" className="account-primary-action">
              Gestisci email
              <ArrowRight aria-hidden="true" />
            </Link>
          </article>

          <article className="account-action-card">
            <div className="account-action-card__icon" aria-hidden="true">
              <ShieldCheck />
            </div>
            <div className="account-action-card__body">
              <span className="account-action-card__eyebrow">Sicurezza</span>
              <h3>Password, MFA e dispositivi</h3>
              <p>{securityHint}</p>
            </div>
            <Link href="/account/security" className="account-primary-action">
              Sicurezza account
              <ArrowRight aria-hidden="true" />
            </Link>
          </article>

          <article className="account-action-card">
            <div className="account-action-card__icon" aria-hidden="true">
              <KeyRound />
            </div>
            <div className="account-action-card__body">
              <span className="account-action-card__eyebrow">Sessione</span>
              <h3>Esci in modo sicuro</h3>
              <p>
                Chiudi la sessione corrente e torna alla schermata di accesso
                Sendwise.
              </p>
            </div>
            <ClerkSignOutButton className="account-primary-action account-primary-action--danger">
              <LogOut aria-hidden="true" />
              Esci
            </ClerkSignOutButton>
          </article>
        </div>
      </section>
    </div>
  );
}
