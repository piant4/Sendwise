import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <Image
          alt="Illustrazione pagina non trovata"
          className="not-found-card__image"
          height={720}
          priority
          src="/illustrations/404.webp"
          width={960}
        />
        <div className="not-found-card__content">
          <p className="not-found-card__eyebrow">Sendwise</p>
          <h1 className="not-found-card__title">Pagina non trovata</h1>
          <p className="not-found-card__message">
            Il percorso richiesto non è disponibile. Torna alla dashboard per
            riprendere il lavoro.
          </p>
        </div>
        <div className="not-found-card__actions">
          <Link
            href="/auth/redirect"
            className="access-state-card__button access-state-card__button--primary"
          >
            Torna alla dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
