import type { ReactNode } from "react";

interface ClientSurfaceProps {
  title: string;
  description?: string;
  aside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

export function ClientSurface({
  title,
  description,
  aside,
  className,
  bodyClassName,
  children,
}: ClientSurfaceProps) {
  return (
    <section className={joinClassNames("client-surface", className)}>
      <header className="client-surface__header">
        <div className="client-surface__copy">
          <h2 className="client-surface__title">{title}</h2>
          {description ? (
            <p className="client-surface__description">{description}</p>
          ) : null}
        </div>
        {aside ? <div className="client-surface__aside">{aside}</div> : null}
      </header>
      <div className={joinClassNames("client-surface__body", bodyClassName)}>{children}</div>
    </section>
  );
}
