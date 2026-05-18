import Link from "next/link";
import { ClerkSignOutButton } from "./ClerkSignOutButton";

interface AccessStateCardProps {
  eyebrow: string;
  title: string;
  message: string;
  detail?: string | null;
  retryHref?: string;
}

export function AccessStateCard({
  eyebrow,
  title,
  message,
  detail,
  retryHref,
}: AccessStateCardProps) {
  return (
    <main className="access-state-page">
      <section className="access-state-card">
        <div className="access-state-card__copy">
          <p className="access-state-card__eyebrow">{eyebrow}</p>
          <h1 className="access-state-card__title">{title}</h1>
          <p className="access-state-card__message">{message}</p>
        </div>

        {detail ? (
          <details className="access-state-card__details">
            <summary>Dettaglio tecnico</summary>
            <p>{detail}</p>
          </details>
        ) : null}

        <div className="access-state-card__actions">
          <ClerkSignOutButton className="access-state-card__button access-state-card__button--primary">
            Esci e torna al login
          </ClerkSignOutButton>
          {retryHref ? (
            <Link
              className="access-state-card__button access-state-card__button--secondary"
              href={retryHref}
            >
              Riprova
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
