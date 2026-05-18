"use client";

import Link from "next/link";
import { useState } from "react";
import { useSessionList, useUser } from "@clerk/nextjs";
import { ArrowLeft, ArrowUpRight, LogOut } from "lucide-react";
import type { AuthMeResponse } from "@/lib/api";
import { AccountDeleteSection } from "@/components/shared/AccountDeleteSection";
import { ClerkSignOutButton } from "@/components/shared/ClerkSignOutButton";
import {
  AccountSecuritySheet,
  type AccountSecuritySheetMode,
} from "./AccountSecuritySheet";

interface AccountWorkspaceProps {
  authState: AuthMeResponse;
  backHref: string;
  backLabel: string;
  email: string | null;
  personalName?: string | null;
  companyName?: string | null;
  profileEditSupported: boolean;
  title: string;
  description: string;
}

interface ActionRowProps {
  actionLabel: string;
  description: string;
  disabled?: boolean;
  label: string;
  onAction?: () => void;
  value: string;
}

function ActionRow({
  actionLabel,
  description,
  disabled = false,
  label,
  onAction,
  value,
}: ActionRowProps) {
  return (
    <div className="settings-row">
      <div className="settings-row__content">
        <span className="settings-row__label">{label}</span>
        <strong className="settings-row__value">{value}</strong>
        <p className="settings-row__description">{description}</p>
      </div>

      <button
        type="button"
        className="settings-row__action"
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
        <ArrowUpRight aria-hidden="true" />
      </button>
    </div>
  );
}

export function AccountWorkspace({
  authState,
  backHref,
  backLabel,
  email,
  personalName,
  companyName,
  profileEditSupported,
  title,
  description,
}: AccountWorkspaceProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { isLoaded: sessionsLoaded, sessions } = useSessionList();
  const [activeSheet, setActiveSheet] = useState<AccountSecuritySheetMode | null>(
    null,
  );

  const managementDisabled = !isLoaded || !isSignedIn;
  const displayEmail = email ?? user?.primaryEmailAddress?.emailAddress ?? "Email non disponibile";
  const displayName =
    personalName?.trim() ||
    (authState.access_type === "platform_admin"
      ? user?.fullName?.trim() || "Profilo gestito da Clerk"
      : "Nome personale non ancora completato");
  const displayCompany = companyName?.trim() || "Non ancora disponibile";
  const passwordState = isLoaded && isSignedIn
    ? user.passwordEnabled
      ? "Configurata"
      : "Da impostare"
    : "Caricamento";
  const mfaState = isLoaded && isSignedIn
    ? user.twoFactorEnabled
      ? "Attiva"
      : "Non attiva"
    : "Caricamento";
  const sessionsState = sessionsLoaded
    ? `${sessions.length} session${sessions.length === 1 ? "e" : "i"} attiv${sessions.length === 1 ? "a" : "e"}`
    : "Caricamento sessioni";
  const isClientAccount = authState.access_type === "client";

  return (
    <>
      <main className="account-page">
        <div className="account-page__glow account-page__glow--mint" />
        <div className="account-page__glow account-page__glow--aqua" />

        <div className="account-layout">
          <section className="settings-shell" aria-label="Area account Sendwise">
            <header className="settings-header">
              <Link href={backHref} className="settings-back">
                <ArrowLeft aria-hidden="true" />
                {backLabel}
              </Link>

              <div className="settings-header__copy">
                <h1>{title}</h1>
                <p className="text-sm leading-7 text-slate-600">{description}</p>
              </div>
            </header>

            <section className="settings-section" aria-labelledby="account-summary">
              <div className="settings-section__header">
                <h2 id="account-summary">Riepilogo</h2>
              </div>
              <div className="campaign-inline-summary">
                <article>
                  <span className="admin-record-row__note">Email</span>
                  <strong>{displayEmail}</strong>
                </article>
                <article>
                  <span className="admin-record-row__note">Accesso</span>
                  <strong>{authState.status === "active" ? "Attivo" : "Da completare"}</strong>
                </article>
                <article>
                  <span className="admin-record-row__note">Sicurezza</span>
                  <strong>Password {passwordState.toLowerCase()} / MFA {mfaState.toLowerCase()}</strong>
                </article>
              </div>
              <p className="admin-record-row__note">
                Sendwise mostra il profilo e lascia credenziali, email verificata e MFA nel pannello protetto Clerk.
              </p>
            </section>

            <div className="settings-sections">
              <section className="settings-section" aria-labelledby="account-profile">
                <div className="settings-section__header">
                  <h2 id="account-profile">Profilo</h2>
                </div>

                <div className="settings-section__body">
                  <div className="settings-row">
                    <div className="settings-row__content">
                      <span className="settings-row__label">Email</span>
                      <strong className="settings-row__value">{displayEmail}</strong>
                      <p className="settings-row__description">
                        Identita e verifica email restano allineate tramite /auth/me.
                      </p>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row__content">
                      <span className="settings-row__label">Nome personale</span>
                      <strong className="settings-row__value">{displayName}</strong>
                      <p className="settings-row__description">
                        {profileEditSupported
                          ? "Questo dato puo essere aggiornato da questa area."
                          : "Campo in sola lettura in questa milestone."}
                      </p>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row__content">
                      <span className="settings-row__label">Azienda</span>
                      <strong className="settings-row__value">{displayCompany}</strong>
                      <p className="settings-row__description">
                        Il nome azienda non e ancora modificabile dal frontend verificato.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="settings-section" aria-labelledby="account-security">
                <div className="settings-section__header">
                  <h2 id="account-security">Sicurezza account</h2>
                </div>

                <div className="settings-section__body">
                  <ActionRow
                    actionLabel="Apri"
                    description="Apri il pannello protetto per verificare o aggiornare l'indirizzo email."
                    disabled={managementDisabled}
                    label="Email e identita"
                    onAction={() => {
                      setActiveSheet("email");
                    }}
                    value={displayEmail}
                  />
                  <ActionRow
                    actionLabel="Apri"
                    description="Password gestita da Clerk. Sendwise non salva password."
                    disabled={managementDisabled}
                    label="Password"
                    onAction={() => {
                      setActiveSheet("password");
                    }}
                    value={passwordState}
                  />
                  <ActionRow
                    actionLabel="Apri"
                    description="Gestisci autenticazione a due fattori e codici di recupero."
                    disabled={managementDisabled}
                    label="MFA"
                    onAction={() => {
                      setActiveSheet("mfa");
                    }}
                    value={mfaState}
                  />
                </div>
              </section>

              <section className="settings-section" aria-labelledby="account-session">
                <div className="settings-section__header">
                  <h2 id="account-session">Sessione</h2>
                </div>

                <div className="settings-section__body">
                  <ActionRow
                    actionLabel="Apri"
                    description="Controlla dispositivi recenti e sessioni attive nel pannello sicurezza di Clerk."
                    disabled={managementDisabled}
                    label="Sessioni e dispositivi"
                    onAction={() => {
                      setActiveSheet("sessions");
                    }}
                    value={sessionsState}
                  />

                  <div className="settings-row">
                    <div className="settings-row__content">
                      <span className="settings-row__label">Logout</span>
                      <strong className="settings-row__value">Esci da Sendwise</strong>
                      <p className="settings-row__description">
                        Chiudi la sessione corrente e torna all&apos;accesso pubblico.
                      </p>
                    </div>

                    <ClerkSignOutButton className="settings-row__action settings-row__action--danger">
                      <LogOut aria-hidden="true" />
                      Esci
                    </ClerkSignOutButton>
                  </div>
                </div>
              </section>

              {isClientAccount ? (
                <section className="settings-section settings-section--account" aria-labelledby="account-danger">
                  <div className="settings-section__header">
                    <h2 id="account-danger">Danger zone</h2>
                  </div>
                  <div className="settings-section__body">
                    <AccountDeleteSection authState={authState} />
                  </div>
                </section>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      <AccountSecuritySheet mode={activeSheet} onOpenChange={setActiveSheet} />
    </>
  );
}
