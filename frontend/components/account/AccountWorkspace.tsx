"use client";

import Link from "next/link";
import { useState } from "react";
import { SignOutButton, useSessionList, useUser } from "@clerk/nextjs";
import {
  ArrowLeft,
  ArrowUpRight,
  KeyRound,
  LogOut,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import type { AuthMeResponse } from "@/lib/api";
import { ThemePreferenceSelector } from "@/components/theme/ThemePreferenceSelector";
import {
  AccountSecuritySheet,
  type AccountSecuritySheetMode,
} from "@/components/account/AccountSecuritySheet";

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

export function AccountWorkspace({
  authState,
  backHref,
  backLabel,
  title,
  description,
}: AccountWorkspaceProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { isLoaded: sessionsLoaded, sessions } = useSessionList();
  const [activeSecuritySheet, setActiveSecuritySheet] =
    useState<AccountSecuritySheetMode | null>(null);
  const managementDisabled = !isLoaded || !isSignedIn;
  const passwordState =
    isLoaded && isSignedIn
      ? user.passwordEnabled
        ? "Configurata"
        : "Da impostare"
      : "Caricamento";
  const mfaState =
    isLoaded && isSignedIn
      ? user.twoFactorEnabled
        ? "Attiva"
        : "Disattiva"
      : "Caricamento";
  const sessionsState = sessionsLoaded
    ? `${sessions.length} session${sessions.length === 1 ? "e" : "i"} attiv${sessions.length === 1 ? "a" : "e"}`
    : "Caricamento";
  const accountAreaTitle =
    authState.access_type === "platform_admin"
      ? "Sicurezza account admin"
      : "Sicurezza account";

  const securityRows: Array<{
    actionLabel: string;
    description: string;
    Icon: typeof KeyRound;
    label: string;
    mode: AccountSecuritySheetMode;
    value: string;
  }> = [
    {
      actionLabel: "Apri",
      description: "Aggiorna la password nel pannello protetto gestito da Clerk.",
      Icon: KeyRound,
      label: "Password",
      mode: "password",
      value: passwordState,
    },
    {
      actionLabel: "Apri",
      description: "Gestisci autenticazione a due fattori e codici di recupero.",
      Icon: ShieldCheck,
      label: "MFA",
      mode: "mfa",
      value: mfaState,
    },
    {
      actionLabel: "Apri",
      description: "Controlla sessioni attive e dispositivi recenti mantenendo il flusso dentro Sendwise.",
      Icon: Smartphone,
      label: "Sessioni e dispositivi",
      mode: "sessions",
      value: sessionsState,
    },
  ];

  return (
    <>
      <main className="account-page">
        <div className="account-page__glow account-page__glow--mint" />
        <div className="account-page__glow account-page__glow--aqua" />

        <div className="account-layout">
          <section
            className="settings-shell settings-shell--minimal"
            aria-label="Area account Sendwise"
          >
            <header className="settings-header">
              <Link href={backHref} className="settings-back">
                <ArrowLeft aria-hidden="true" />
                {backLabel}
              </Link>

              <div className="settings-header__copy">
                <h1>{title}</h1>
                <p className="settings-header__description">{description}</p>
              </div>
            </header>

            <div className="settings-sections settings-sections--minimal">
              <ThemePreferenceSelector />

              <section
                className="settings-section settings-section--clerk"
                aria-labelledby="account-security"
              >
                <div className="settings-section__header">
                  <h2 id="account-security">{accountAreaTitle}</h2>
                </div>

                <div className="settings-section__body">
                  {securityRows.map(({ actionLabel, description, Icon, label, mode, value }) => (
                    <div key={label} className="settings-row">
                      <div className="settings-row__content">
                        <span className="settings-row__label">{label}</span>
                        <strong className="settings-row__value">{value}</strong>
                        <p className="settings-row__description">{description}</p>
                      </div>

                      <button
                        type="button"
                        className="settings-row__action"
                        disabled={managementDisabled}
                        onClick={() => {
                          setActiveSecuritySheet(mode);
                        }}
                      >
                        <Icon aria-hidden="true" />
                        {actionLabel}
                        <ArrowUpRight aria-hidden="true" />
                      </button>
                    </div>
                  ))}

                  <div className="settings-row">
                    <div className="settings-row__content">
                      <span className="settings-row__label">Sessione</span>
                      <strong className="settings-row__value">Esci da Sendwise</strong>
                      <p className="settings-row__description">
                        Chiudi la sessione corrente senza esporre impostazioni profilo o personalizzazione.
                      </p>
                    </div>

                    <SignOutButton>
                      <button type="button" className="settings-row__action settings-row__action--danger">
                        <LogOut aria-hidden="true" />
                        Esci
                      </button>
                    </SignOutButton>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>
      </main>

      <AccountSecuritySheet
        mode={activeSecuritySheet}
        onOpenChange={setActiveSecuritySheet}
      />
    </>
  );
}
