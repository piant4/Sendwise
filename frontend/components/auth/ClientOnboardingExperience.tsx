"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/shared/BrandMark";
import type { AuthMeResponse } from "@/lib/api";

interface ClientOnboardingExperienceProps {
  authMe: AuthMeResponse;
}

export function ClientOnboardingExperience({
  authMe,
}: ClientOnboardingExperienceProps) {
  void authMe;
  return (
    <main className="login-page">
      <div className="login-page__glow login-page__glow--mint" />
      <div className="login-page__glow login-page__glow--aqua" />

      <div className="login-layout">
        <section className="login-stage">
          <BrandMark size="lg" />

          <div className="login-copy">
            <div className="login-pills">
              <span className="login-pill">Accesso cliente</span>
              <span className="login-pill">Percorso disattivato</span>
            </div>
            <h1 className="login-title">Questo passaggio non e piu disponibile.</h1>
            <p className="login-lead">
              Accedi dal pannello principale oppure richiedi una nuova email di
              accesso sicura.
            </p>
          </div>
        </section>

        <section className="login-card" data-step="credentials">
          <div className="login-card__header">
            <p className="login-card__eyebrow">Accesso</p>
            <h2 className="login-card__title">Vai al login Sendwise</h2>
            <p className="login-card__description">
              Il precedente completamento profilo dentro Sendwise e stato
              dismesso. Il portale usa solo l&apos;accesso protetto gestito da Clerk.
            </p>
          </div>

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Sicurezza invariata</strong>
              <span>Sendwise non invia password permanenti e non le salva nel proprio database.</span>
            </div>
            <ShieldCheck aria-hidden="true" className="login-card__footer-accent" />
          </div>

          <Link href="/login" className="login-submit">
            Vai al pannello
          </Link>
        </section>
      </div>
    </main>
  );
}
