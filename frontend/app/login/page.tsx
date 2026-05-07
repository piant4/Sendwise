"use client";

import { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "../../components/shared/BrandMark";

const trustNotes = [
  "Accesso riservato agli utenti autorizzati",
  "Abilitazione account gestita internamente",
  "Ingresso temporaneo disponibile per la verifica locale",
];

const highlights = [
  "Supervisione di campagne, limiti email e stato sistema in un unico spazio operativo.",
  "Interfaccia ufficiale Sendwise pronta per l'integrazione dell'autenticazione futura senza cambiare la postura del prodotto.",
  "Flusso di accesso essenziale, pensato per team interni e utenti gia abilitati.",
];

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
          <div className="login-stage__header">
            <div className="login-pills">
              <span className="login-pill">Accesso riservato</span>
            </div>

            <BrandMark size="lg" />

            <div className="login-copy">
              <p className="login-eyebrow">Accesso operativo premium</p>
              <h1 className="login-title">
                Accedi all&apos;area operativa Sendwise con un&apos;interfaccia
                ufficiale, tecnica e controllata.
              </h1>
              <p className="login-lead">
                Pannello di accesso per utenti autorizzati. L&apos;abilitazione
                degli account viene gestita internamente e l&apos;integrazione
                completa dell&apos;autenticazione verra collegata in una fase
                successiva.
              </p>
            </div>
          </div>

          <div className="login-note-grid">
            {trustNotes.map((note) => (
              <article key={note} className="login-note-card">
                <span className="login-note-card__label">Sendwise</span>
                <p className="login-note-card__text">{note}</p>
              </article>
            ))}
          </div>

          <section className="login-foundation">
            <div className="login-foundation__header">
              <div>
                <p className="login-foundation__eyebrow">Pannello operativo</p>
                <p className="login-foundation__title">
                  Operativita compatta, gerarchia KPI chiara e tono SaaS
                  tecnico allineato al prodotto.
                </p>
              </div>
              <span className="login-foundation__badge">Area interna</span>
            </div>

            <div className="login-highlight-grid">
              {highlights.map((item, index) => (
                <article key={item} className="login-highlight-card">
                  <span className="login-highlight-card__index">
                    0{index + 1}
                  </span>
                  <p className="login-highlight-card__text">{item}</p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="login-card">
          <div className="login-card__header">
            <div className="login-card__topline">
              <p className="login-card__eyebrow">Accesso Sendwise</p>
              <span className="login-card__badge">Utenti autorizzati</span>
            </div>
            <h2 className="login-card__title">Accedi allo spazio operativo</h2>
            <p className="login-card__description">
              Inserisci le credenziali del tuo account. In questa fase
              l&apos;accesso instrada verso l&apos;area interna predefinita per
              la verifica controllata dell&apos;interfaccia.
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
                <span className="login-field__hint">Verifica temporanea interna</span>
              </span>
              <input
                className="login-input"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Inserisci la password"
              />
            </label>

            <div className="login-helper">
              Accesso riservato agli utenti autorizzati. Per questa fase
              l&apos;ingresso e gestito localmente e apre l&apos;area interna
              predefinita senza esporre opzioni pubbliche di registrazione.
            </div>

            <button type="submit" className="login-submit">
              Accedi
            </button>
          </form>

          <div className="login-card__footer">
            <span>Abilitazione account gestita internamente.</span>
            <div className="login-card__links">
              <span>Supporto interno</span>
              <span>Stato piattaforma</span>
              <span>Nessuna registrazione pubblica</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
