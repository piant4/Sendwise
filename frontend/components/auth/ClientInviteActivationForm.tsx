"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/shared/BrandMark";

interface ClientInviteActivationFormProps {
  ticket: string;
}

export function ClientInviteActivationForm({
  ticket,
}: ClientInviteActivationFormProps) {
  void ticket;
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
              <span className="login-pill">Flusso legacy disattivato</span>
            </div>
            <h1 className="login-title">Questo flusso non e piu attivo.</h1>
            <p className="login-lead">
              Accedi dal pannello Sendwise oppure richiedi una nuova email di
              accesso al tuo referente.
            </p>
          </div>
        </section>

        <section className="login-card" data-step="credentials">
          <div className="login-card__header">
            <p className="login-card__eyebrow">Accesso</p>
            <h2 className="login-card__title">Usa il pannello principale</h2>
            <p className="login-card__description">
              I vecchi link di attivazione non vengono piu completati dentro
              Sendwise. Per entrare nel portale usa la pagina di login oppure
              fatti inviare una nuova email di accesso sicura.
            </p>
          </div>

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Accesso protetto</strong>
              <span>
                Le password continuano a essere gestite da Clerk. Sendwise non
                mostra ne memorizza credenziali in chiaro.
              </span>
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
