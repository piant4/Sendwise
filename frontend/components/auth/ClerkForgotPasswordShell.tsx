"use client";

import { SignIn } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/shared/BrandMark";

export function ClerkForgotPasswordShell() {
  return (
    <main className="login-page">
      <div className="login-page__glow login-page__glow--mint" />
      <div className="login-page__glow login-page__glow--aqua" />

      <div className="login-layout">
        <section className="login-stage">
          <BrandMark size="lg" />

          <div className="login-copy">
            <div className="login-pills">
              <span className="login-pill">Recupero accesso</span>
            </div>
            <h1 className="login-title">
              Reimposta la password senza uscire dal perimetro protetto
              Sendwise.
            </h1>
            <p className="login-lead">
              Clerk gestisce il codice di verifica e la nuova password.
              Sendwise non salva password.
            </p>
          </div>
        </section>

        <section className="login-card" data-step="credentials">
          <div className="login-card__header">
            <h2 className="login-card__title">Recupero password</h2>
            <p className="login-card__description">
              Richiedi il codice di reset e completa l&apos;aggiornamento della
              password con il flusso supportato da Clerk.
            </p>
          </div>

          <div className="login-clerk-shell">
            <SignIn
              appearance={{
                elements: {
                  card: "bg-transparent border-0 shadow-none p-0",
                  cardBox: "shadow-none",
                  footer: "hidden",
                  formButtonPrimary:
                    "bg-[var(--sw-primary)] hover:bg-[var(--sw-primary-hover)] text-white shadow-none",
                  formFieldInput:
                    "min-h-12 rounded-[14px] border border-[#d9ddd7] bg-[#fcfcfa] text-[var(--sw-olive)]",
                  formFieldLabel: "text-[var(--sw-text-muted)]",
                  header: "hidden",
                  identityPreviewText: "text-[var(--sw-text-muted)]",
                  identityPreviewEditButton:
                    "text-[var(--sw-primary)] hover:text-[var(--sw-primary-hover)]",
                  rootBox: "w-full",
                  socialButtonsBlockButton: "rounded-[14px]",
                  formResendCodeLink:
                    "text-[var(--sw-primary)] hover:text-[var(--sw-primary-hover)]",
                  otpCodeFieldInput:
                    "min-h-12 rounded-[14px] border border-[#d9ddd7] bg-[#fcfcfa] text-[var(--sw-olive)]",
                  alert:
                    "rounded-2xl border border-[rgba(166,70,63,0.2)] bg-[rgba(244,225,223,0.92)] text-[var(--sw-danger)]",
                },
              }}
              path="/login"
              routing="path"
              signUpUrl="/login"
              fallbackRedirectUrl="/auth/redirect"
              forceRedirectUrl="/auth/redirect"
            />
          </div>

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Recupero account gestito da Clerk.</strong>
              <span>
                Dopo il reset, il rientro passa ancora da /auth/redirect.
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
