"use client";

import Link from "next/link";
import { useState } from "react";
import { useSessionList, useUser } from "@clerk/nextjs";
import { ArrowLeft, ArrowUpRight, Building2, LogOut, Mail, UserRound } from "lucide-react";
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

function ProfileField({
  icon: Icon,
  label,
  value,
  help,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  help: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4">
      <div className="mb-3 flex items-center gap-3 text-slate-900">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="text-sm font-semibold text-slate-900">{value}</p>
        </div>
      </div>
      <p className="text-sm leading-6 text-slate-600">{help}</p>
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

            <section className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="space-y-2">
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-sky-700">
                    Account Sendwise
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                    Dati profilo nel prodotto, sicurezza in Clerk.
                  </h2>
                  <p className="text-sm leading-6 text-slate-600">
                    Il backend Sendwise resta la fonte di verita per accesso cliente,
                    portal context e autorizzazione. Clerk gestisce solo credenziali,
                    email verificata, password e MFA.
                  </p>
                </div>

                <dl className="grid gap-3 rounded-[20px] border border-white/70 bg-white/80 p-4">
                  <div>
                    <dt className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                      Email corrente
                    </dt>
                    <dd className="mt-1 break-all text-sm font-semibold text-slate-950">
                      {displayEmail}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                      Stato accesso
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-950">
                      {authState.status === "active" ? "Attivo" : "Da completare"}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            <div className="settings-sections">
              <section className="settings-section" aria-labelledby="account-profile">
                <div className="settings-section__header">
                  <h2 id="account-profile">Profilo</h2>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <ProfileField
                    icon={Mail}
                    label="Email"
                    value={displayEmail}
                    help="Identita e verifica email restano gestite da Clerk e allineate al backend tramite /auth/me."
                  />
                  <ProfileField
                    icon={UserRound}
                    label="Nome personale"
                    value={displayName}
                    help={
                      profileEditSupported
                        ? "Questo dato puo essere aggiornato direttamente da questa pagina."
                        : "Questo campo resta in sola lettura: in questa milestone non esiste un endpoint cliente documentato per aggiornarlo senza cambiare il modello auth."
                    }
                  />
                  <ProfileField
                    icon={Building2}
                    label="Azienda"
                    value={displayCompany}
                    help="Il nome azienda non e ancora supportato dal profilo cliente V1 verificato, quindi non viene modificato dal frontend."
                  />
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
