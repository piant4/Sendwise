"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "../../components/shared/BrandMark";
import { MockModeBadge } from "../../components/shared/MockModeBadge";

type DemoRole = "admin" | "client";

const demoDestinations: Record<DemoRole, "/admin" | "/client"> = {
  admin: "/admin",
  client: "/client",
};

const trustNotes = [
  "Accesso demo guidato",
  "Ambiente solo UI",
  "Nessuna integrazione backend",
];

const highlights = [
  "Controllo campagne, contatti e deliverability in un unico spazio operativo.",
  "Interfaccia mock solo frontend: nessuna credenziale viene salvata, verificata o inviata.",
  "Stessa base visiva del prodotto, senza shell dashboard su questa route.",
];

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<DemoRole>("client");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(demoDestinations[role]);
  }

  return (
    <main className="login-page">
      <div className="login-page__glow login-page__glow--mint" />
      <div className="login-page__glow login-page__glow--aqua" />

      <div className="login-layout">
        <section className="login-stage">
          <div className="login-stage__header">
            <div className="login-pills">
              <MockModeBadge />
              <span className="login-pill">Login demo</span>
            </div>

            <BrandMark size="lg" />

            <div className="login-copy">
              <p className="login-eyebrow">Accesso operativo premium</p>
              <h1 className="login-title">
                Accedi alla demo Sendwise con un&apos;interfaccia tecnica,
                pulita e pronta alla verifica visuale.
              </h1>
              <p className="login-lead">
                Questa schermata riproduce l&apos;esperienza di accesso del
                prodotto senza autenticazione reale. Serve per validare il look
                and feel del frontend e instradare i ruoli demo.
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
                <p className="login-foundation__eyebrow">Fondazione 0.8B</p>
                <p className="login-foundation__title">
                  Layout editoriale, palette controllata, tono SaaS operativo.
                </p>
              </div>
              <span className="login-foundation__badge">Solo frontend</span>
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
              <p className="login-card__eyebrow">Accesso mock</p>
              <span className="login-card__badge">Demo controllata</span>
            </div>
            <h2 className="login-card__title">Entra nello spazio demo</h2>
            <p className="login-card__description">
              Credenziali illustrative e instradamento locale verso l&apos;area
              admin o cliente. Nessun token, cookie o chiamata API viene
              creato.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            aria-label="Modulo di accesso mock"
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
                <span className="login-field__hint">Non validata in demo</span>
              </span>
              <input
                className="login-input"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Inserisci un valore qualsiasi"
              />
            </label>

            <label className="login-field">
              <span className="login-field__label">Ruolo demo</span>
              <select
                className="login-input login-select"
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value as DemoRole)}
              >
                <option value="client">Cliente demo</option>
                <option value="admin">Admin demo</option>
              </select>
            </label>

            <div className="login-helper">
              Questo accesso e&apos; puramente visuale. Al submit vieni
              reindirizzato verso la route demo coerente con il ruolo
              selezionato.
            </div>

            <button type="submit" className="login-submit">
              Accedi alla demo
            </button>
          </form>

          <div className="login-card__footer">
            <span>Uso interno frontend. Nessuna persistenza locale.</span>
            <div className="login-card__links">
              <Link href="#">Privacy</Link>
              <Link href="#">Supporto</Link>
              <Link href="#">Stato piattaforma</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
