"use client";

import { FormEvent } from "react";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { BrandMark } from "../../components/shared/BrandMark";

export default function LoginPage() {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/admin");
  }

  return (
    <main className="login-page">
      <div className="login-page__glow login-page__glow--mint" />
      <div className="login-page__glow login-page__glow--aqua" />

      <div className="login-layout">
        <section className="login-stage">
          <div className="login-pills">
            <span className="login-pill">Accesso riservato</span>
          </div>

          <BrandMark size="lg" />

          <div className="login-copy">
            <p className="login-eyebrow">Piattaforma operativa</p>
            <h1 className="login-title">
              Campagne email, clienti e controllo operativo nello stesso
              workspace.
            </h1>
            <p className="login-lead">
              Spazio riservato per coordinare volumi, stato campagne e presidio
              delle attivita essenziali Sendwise.
            </p>
          </div>
        </section>

        <section className="login-card">
          <div className="login-card__header">
            <h2 className="login-card__title">Accedi</h2>
            <p className="login-card__description">
              Console riservata per gestire campagne email, clienti e controllo
              operativo in un unico spazio.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            aria-label="Modulo di accesso"
            className="login-form"
          >
            <label className="login-field">
              <span className="login-field__label">Email o username</span>
              <input
                className="login-input"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="team@sendwise.local"
              />
            </label>

            <label className="login-field">
              <span className="login-field__label">Password</span>
              <input
                className="login-input"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Inserisci la password"
              />
            </label>

            <button type="submit" className="login-submit">
              Accedi
            </button>
          </form>

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Accesso riservato agli utenti autorizzati.</strong>
              <span>
                Abilitazione account e supporto operativo gestiti dal team
                Sendwise.
              </span>
            </div>
            <LifeBuoy aria-hidden="true" className="login-card__footer-accent" />
          </div>
        </section>
      </div>
    </main>
  );
}
