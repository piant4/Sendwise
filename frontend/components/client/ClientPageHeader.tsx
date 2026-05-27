import type { ReactNode } from "react";

interface ClientPageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function ClientPageHeader({
  title,
  description,
  eyebrow,
  actions,
}: ClientPageHeaderProps) {
  const hasDescription = Boolean(description?.trim());

  return (
    <header
      className="client-page-header"
      data-has-eyebrow={eyebrow?.trim() ? "true" : undefined}
    >
      <div className="client-page-header__copy">
        {/* {eyebrow ? <p className="client-page-header__eyebrow">{eyebrow}</p> : null} */}
        <h1 className="client-page-header__title">{title}</h1>
        {hasDescription ? (
          <p className="client-page-header__description">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="client-page-header__actions">{actions}</div> : null}
    </header>
  );
}
