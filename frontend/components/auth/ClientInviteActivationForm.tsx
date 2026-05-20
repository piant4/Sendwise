"use client";

import { SignUp } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/shared/BrandMark";

const LOGIN_REDIRECT_PATH = "/auth/redirect";

type InviteActivationMode = "custom-sdk" | "clerk-framed";

const DEFAULT_TICKET_ACTIVATION_MODE: InviteActivationMode = "clerk-framed";

function resolveInviteActivationMode(): InviteActivationMode {
  // Clerk does not expose invitation follow-up requirements or pending session tasks
  // before the ticket flow starts, so the safe default is the framed Clerk flow.
  return DEFAULT_TICKET_ACTIVATION_MODE;
}

interface ClientInviteActivationFormProps {
  ticket: string;
}

export function ClientInviteActivationForm({
  ticket,
}: ClientInviteActivationFormProps) {
  const activationMode = resolveInviteActivationMode();

  return (
    <main className="login-page">
      <div className="login-page__glow login-page__glow--mint" />
      <div className="login-page__glow login-page__glow--aqua" />

      <div className="login-layout">
        <section className="login-stage">
          <BrandMark size="lg" />

          <div className="login-copy">
            <div className="login-pills">
              <span className="login-pill">Invito cliente</span>
              <span className="login-pill">Attivazione protetta</span>
            </div>
            <h1 className="login-title">Attiva il tuo accesso Sendwise.</h1>
            <p className="login-lead">
              Completa l&apos;invito direttamente in questa schermata. Quando
              l&apos;attivazione e la verifica dell&apos;account sono concluse,
              Sendwise finalizza il tuo ingresso nel portale cliente senza un
              secondo form password.
            </p>
          </div>

          <div className="login-note-grid">
            <article className="login-note-card">
              <span className="login-note-card__label">01</span>
              <p className="login-note-card__text">
                L&apos;attivazione parte e resta nello stesso riquadro.
              </p>
            </article>
            <article className="login-note-card">
              <span className="login-note-card__label">02</span>
              <p className="login-note-card__text">
                Password, verifica e sessione restano gestite da Clerk.
              </p>
            </article>
            <article className="login-note-card">
              <span className="login-note-card__label">03</span>
              <p className="login-note-card__text">
                Dopo l&apos;autenticazione, Sendwise completa l&apos;onboarding
                e ti porta nel portale cliente.
              </p>
            </article>
          </div>
        </section>

        <section className="login-card" data-step="credentials">
          <div className="login-card__header">
            <p className="login-card__eyebrow">Onboarding</p>
            <h2 className="login-card__title">Completa il tuo invito</h2>
            <p className="login-card__description">
              Il flusso mostrato qui viene scelto prima di qualsiasi invio, cosi
              non esiste piu il passaggio da un form Sendwise a una schermata
              Clerk successiva.
            </p>
          </div>

          {activationMode === "clerk-framed" ? (
            <div className="login-clerk-shell">
              <SignUp
                key={`${activationMode}:${ticket}`}
                fallbackRedirectUrl={LOGIN_REDIRECT_PATH}
                forceRedirectUrl={LOGIN_REDIRECT_PATH}
                path="/auth/redirect"
                routing="path"
                signInUrl="/login"
              />
            </div>
          ) : null}

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Credenziali protette</strong>
              <span>Sendwise non salva password e completa il portale solo dopo una sessione Clerk valida.</span>
            </div>
            <ShieldCheck aria-hidden="true" className="login-card__footer-accent" />
          </div>
        </section>
      </div>
    </main>
  );
}
