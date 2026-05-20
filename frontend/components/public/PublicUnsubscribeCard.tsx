"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ApiError,
  isApiConfigurationError,
  submitPublicUnsubscribe,
} from "../../lib/api";
import type { PublicUnsubscribeStatus } from "../../types";

type ViewState =
  | "confirm"
  | "loading"
  | "unsubscribed"
  | "already_unsubscribed"
  | "invalid"
  | "unavailable";

interface PublicUnsubscribeCardProps {
  token?: string;
}

const VIEW_COPY: Record<
  ViewState,
  {
    badge: string;
    title: string;
    description: string;
  }
> = {
  confirm: {
    badge: "Sendwise",
    title: "Vuoi disiscriverti?",
    description:
      "Non riceverai piu email da questa campagna o da questo mittente.",
  },
  loading: {
    badge: "Richiesta in corso",
    title: "Sto aggiornando la tua preferenza",
    description: "Attendi qualche secondo mentre completiamo la disiscrizione.",
  },
  unsubscribed: {
    badge: "Operazione completata",
    title: "Disiscrizione completata",
    description: "La tua richiesta e stata registrata con successo.",
  },
  already_unsubscribed: {
    badge: "Preferenza gia aggiornata",
    title: "Sei gia disiscritto",
    description: "Avevamo gia registrato la tua scelta.",
  },
  invalid: {
    badge: "Link non valido",
    title: "Questo link non e piu disponibile",
    description:
      "Richiedi una nuova email oppure contatta il supporto se hai bisogno di assistenza.",
  },
  unavailable: {
    badge: "Servizio non disponibile",
    title: "Non riusciamo a completare la richiesta",
    description:
      "Riprova tra poco. Se il problema continua, contatta il supporto.",
  },
};

function mapErrorToViewState(error: unknown): ViewState {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return "invalid";
    }

    if (error.status === 503 || error.isNetworkError || isApiConfigurationError(error)) {
      return "unavailable";
    }
  }

  return "unavailable";
}

export function PublicUnsubscribeCard({
  token,
}: PublicUnsubscribeCardProps) {
  const [viewState, setViewState] = useState<ViewState>(token ? "confirm" : "invalid");

  const content = VIEW_COPY[viewState];
  const showPrimaryAction = viewState === "confirm";
  const showLoading = viewState === "loading";
  const showTerminalState = !showPrimaryAction && !showLoading;

  async function handleUnsubscribe() {
    if (!token) {
      setViewState("invalid");
      return;
    }

    setViewState("loading");

    try {
      const response = await submitPublicUnsubscribe(token);
      setViewState(response.status as PublicUnsubscribeStatus);
    } catch (error) {
      setViewState(mapErrorToViewState(error));
    }
  }

  return (
    <main className="public-page-shell">
      <section
        className="public-card"
        aria-live="polite"
        aria-busy={showLoading}
      >
        <span className="public-card__badge">{content.badge}</span>
        <h1 className="public-card__title">{content.title}</h1>
        <p className="public-card__description">{content.description}</p>

        <div className="public-card__actions">
          {showPrimaryAction ? (
            <>
              <button
                className="public-card__button public-card__button--primary"
                type="button"
                onClick={handleUnsubscribe}
              >
                Disiscrivimi
              </button>
              <Link
                className="public-card__button public-card__button--secondary"
                href="/"
              >
                Annulla
              </Link>
            </>
          ) : null}

          {showLoading ? (
            <>
              <button
                className="public-card__button public-card__button--primary"
                type="button"
                disabled
              >
                Disiscrizione in corso...
              </button>
              <span className="public-card__helper">
                Non chiudere questa pagina.
              </span>
            </>
          ) : null}

          {showTerminalState ? (
            <Link
              className="public-card__button public-card__button--secondary"
              href="/"
            >
              Chiudi
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
