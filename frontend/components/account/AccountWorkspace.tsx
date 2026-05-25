"use client";

import Link from "next/link";
import { UserProfile, useSessionList, useUser } from "@clerk/nextjs";
import { ArrowLeft, LogOut } from "lucide-react";
import type { AuthMeResponse } from "@/lib/api";
import { AccountDeleteSection } from "@/components/shared/AccountDeleteSection";
import { ClerkSignOutButton } from "@/components/shared/ClerkSignOutButton";

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
  email,
  personalName,
  companyName,
  profileEditSupported,
  title,
  description,
}: AccountWorkspaceProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { isLoaded: sessionsLoaded, sessions } = useSessionList();
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
                  <h2 id="account-security">Profilo e sicurezza</h2>
                </div>

                <div className="settings-section__body">
                  <div className="account-clerk-shell">
                    <p className="account-clerk-shell__helper">
                      Questa area usa i componenti account di Clerk per profilo,
                      email, password, MFA e dispositivi, mantenendo la cornice
                      Sendwise.
                    </p>
                    <UserProfile
                      appearance={{
                        elements: {
                          card: "bg-transparent border-0 shadow-none p-0",
                          cardBox: "shadow-none",
                          navbar: "bg-[rgba(248,250,252,0.9)] border border-[rgba(226,232,240,0.95)] rounded-2xl",
                          navbarButton:
                            "text-[var(--sw-text-muted)] hover:text-[var(--sw-primary)] rounded-xl",
                          navbarButtonActive:
                            "bg-[rgba(93,118,78,0.12)] text-[var(--sw-primary)] shadow-none",
                          pageScrollBox: "p-0",
                          profilePage: "p-0",
                          profileSection: "rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white/90",
                          formButtonPrimary:
                            "bg-[var(--sw-primary)] hover:bg-[var(--sw-primary-hover)] text-white shadow-none",
                          formFieldInput:
                            "min-h-12 rounded-[14px] border border-[#d9ddd7] bg-[#fcfcfa] text-[var(--sw-olive)]",
                          formFieldLabel: "text-[var(--sw-text-muted)]",
                          badge: "bg-[rgba(93,118,78,0.12)] text-[var(--sw-primary)]",
                          alert:
                            "rounded-2xl border border-[rgba(166,70,63,0.2)] bg-[rgba(244,225,223,0.92)] text-[var(--sw-danger)]",
                          footer: "hidden",
                          headerTitle: "text-[var(--sw-olive)]",
                          headerSubtitle: "text-[var(--sw-text-muted)]",
                          accordionTriggerButton:
                            "text-[var(--sw-olive)] hover:text-[var(--sw-primary)]",
                          menuButton:
                            "text-[var(--sw-text-muted)] hover:text-[var(--sw-primary)]",
                        },
                      }}
                      routing="hash"
                      fallback={
                        <div className="account-clerk-shell__loading">
                          Caricamento impostazioni protette...
                        </div>
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="settings-section" aria-labelledby="account-session">
                <div className="settings-section__header">
                  <h2 id="account-session">Sessione</h2>
                </div>

                <div className="settings-section__body">
                  <div className="settings-row">
                    <div className="settings-row__content">
                      <span className="settings-row__label">Sessioni e dispositivi</span>
                      <strong className="settings-row__value">{sessionsState}</strong>
                      <p className="settings-row__description">
                        La gestione dettagliata resta nel pannello Clerk mostrato sopra.
                      </p>
                    </div>
                  </div>

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
    </>
  );
}
