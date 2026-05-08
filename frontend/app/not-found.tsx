import Link from "next/link";
import { BrandMark } from "../components/shared/BrandMark";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <BrandMark size="lg" />
        <p className="not-found-card__eyebrow">Errore 404</p>
        <h1 className="not-found-card__title">Questa pagina non esiste o non e disponibile.</h1>
        <p className="not-found-card__message">
          Il percorso richiesto non corrisponde a una vista Sendwise valida
          oppure non e accessibile con la sessione corrente.
        </p>
        <div className="not-found-card__actions">
          <Link
            href="/auth/redirect"
            className="access-state-card__button access-state-card__button--primary"
          >
            Torna alla dashboard
          </Link>
          <Link
            href="/login"
            className="access-state-card__button access-state-card__button--secondary"
          >
            Vai al login
          </Link>
        </div>
      </section>
    </main>
  );
}
