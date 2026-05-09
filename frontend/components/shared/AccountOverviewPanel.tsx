"use client";

import Link from "next/link";
import { useState } from "react";
import { useSessionList, useUser } from "@clerk/nextjs";
import { ArrowLeft, ArrowUpRight, LogOut } from "lucide-react";
import type { AuthMeResponse } from "@/lib/api";
import { AccountDeleteSection } from "./AccountDeleteSection";
import { AccountSettingsSheet, type AccountSettingsSheetMode } from "./AccountSettingsSheet";
import { ClerkSignOutButton } from "./ClerkSignOutButton";

interface AccountOverviewPanelProps {
  authState: AuthMeResponse | null;
  backHref: string;
}

interface SettingsRowProps {
  actionLabel: string;
  description: string;
  disabled?: boolean;
  label: string;
  onAction?: () => void;
  value: string;
}

function SettingsRow({
  actionLabel,
  description,
  disabled = false,
  label,
  onAction,
  value,
}: SettingsRowProps) {
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

export function AccountOverviewPanel({
  authState,
  backHref,
}: AccountOverviewPanelProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { isLoaded: sessionsLoaded, sessions } = useSessionList();
  const [activeSheet, setActiveSheet] = useState<AccountSettingsSheetMode | null>(
    null,
  );

  const managementDisabled = !isLoaded || !isSignedIn;
  const email = user?.primaryEmailAddress?.emailAddress ?? "Nessuna email";
  const fullName = user?.fullName?.trim() || "Nome non impostato";
  const passwordState = isLoaded && isSignedIn
    ? user.passwordEnabled
      ? "Configurata"
      : "Da impostare"
    : "Caricamento";
  const mfaState = isLoaded && isSignedIn
    ? user.twoFactorEnabled
      ? "Attiva"
      : "Disattiva"
    : "Caricamento";
  const sessionsState = sessionsLoaded
    ? `${sessions.length} session${sessions.length === 1 ? "e" : "i"} disponibile${sessions.length === 1 ? "" : "i"} su questo dispositivo`
    : "Caricamento sessioni";
  const backLabel =
    authState?.access_type === "platform_admin"
      ? "Torna alla dashboard admin"
      : "Torna alla dashboard";

  return (
    <>
      <section className="settings-shell" aria-label="Impostazioni account">
        <header className="settings-header">
          <Link href={backHref} className="settings-back">
            <ArrowLeft aria-hidden="true" />
            {backLabel}
          </Link>

          <div className="settings-header__copy">
            <h1>Impostazioni</h1>
          </div>
        </header>

        <div className="settings-sections">
          <section className="settings-section" aria-labelledby="settings-profile">
            <div className="settings-section__header">
              <h2 id="settings-profile">Profilo</h2>
            </div>

            <div className="settings-section__body">
              <SettingsRow
                actionLabel="Modifica"
                description="Aggiorna il nome salvato in Clerk senza uscire da Sendwise."
                disabled={managementDisabled}
                label="Nome"
                onAction={() => {
                  setActiveSheet("name");
                }}
                value={fullName}
              />
              <SettingsRow
                actionLabel="Gestisci"
                description="Controlla email principale e identita direttamente dentro il pannello account."
                disabled={managementDisabled}
                label="Email"
                onAction={() => {
                  setActiveSheet("email");
                }}
                value={email}
              />
            </div>
          </section>

          <section className="settings-section" aria-labelledby="settings-security">
            <div className="settings-section__header">
              <h2 id="settings-security">Sicurezza</h2>
            </div>

            <div className="settings-section__body">
              <SettingsRow
                actionLabel="Apri"
                description="Aggiorna la password nel pannello sicurezza contenuto qui dentro."
                disabled={managementDisabled}
                label="Password"
                onAction={() => {
                  setActiveSheet("password");
                }}
                value={passwordState}
              />
              <SettingsRow
                actionLabel="Apri"
                description="Gestisci autenticazione a due fattori e codici di recupero."
                disabled={managementDisabled}
                label="MFA"
                onAction={() => {
                  setActiveSheet("mfa");
                }}
                value={mfaState}
              />
              <SettingsRow
                actionLabel="Apri"
                description="Verifica sessioni attive e dispositivi recenti disponibili in Clerk."
                disabled={managementDisabled}
                label="Sessioni e dispositivi"
                onAction={() => {
                  setActiveSheet("sessions");
                }}
                value={sessionsState}
              />
            </div>
          </section>

          <section className="settings-section settings-section--account" aria-labelledby="settings-account">
            <div className="settings-section__header">
              <h2 id="settings-account">Account</h2>
            </div>

            <div className="settings-section__body">
              <div className="settings-row">
                <div className="settings-row__content">
                  <span className="settings-row__label">Sessione</span>
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

              <AccountDeleteSection authState={authState} />
            </div>
          </section>
        </div>
      </section>

      <AccountSettingsSheet mode={activeSheet} onOpenChange={setActiveSheet} />
    </>
  );
}
