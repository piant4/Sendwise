import type { ReactNode } from "react";

interface ClientSurfaceProps {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}

export function ClientSurface({
  title,
  description,
  aside,
  children,
}: ClientSurfaceProps) {
  return (
    <section className="client-surface">
      <header className="client-surface__header">
        <div className="client-surface__copy">
          <h2 className="client-surface__title">{title}</h2>
          {description ? (
            <p className="client-surface__description">{description}</p>
          ) : null}
        </div>
        {aside ? <div className="client-surface__aside">{aside}</div> : null}
      </header>
      <div className="client-surface__body">{children}</div>
    </section>
  );
}
