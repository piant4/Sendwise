import Link from "next/link";
import { BrandMark } from "../components/shared/BrandMark";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <BrandMark size="lg" />
        <h1 className="not-found-card__title">Errore 404</h1>
        <p className="not-found-card__message">
          Questa pagina non esiste o non e disponibile.
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
