"use client";

import { FormEvent } from "react";
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
              Campagne email controllate, monitoraggio clienti e supervisione
              dei limiti di invio.
            </h1>
            <p className="login-lead">
              Accesso riservato agli utenti autorizzati.
            </p>
          </div>
        </section>

        <section className="login-card">
          <div className="login-card__header">
            <p className="login-card__eyebrow">Area riservata</p>
            <h2 className="login-card__title">Accedi</h2>
            <p className="login-card__description">
              Inserisci le credenziali del tuo account per aprire la dashboard
              operativa ufficiale.
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
              <span className="login-field__row">
                <span className="login-field__label">Password</span>
                <span className="login-field__hint">Verifica interna</span>
              </span>
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
            <span>Abilitazione account gestita internamente.</span>
            <div className="login-card__links">
              <span>Accesso locale temporaneo</span>
              <span>Supporto interno</span>
              <span>Nessuna registrazione pubblica</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
