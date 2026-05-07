import type { ReactNode } from "react";

interface AdminSurfaceProps {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}

export function AdminSurface({
  title,
  description,
  aside,
  children,
}: AdminSurfaceProps) {
  return (
    <section className="admin-surface">
      <header className="admin-surface__header">
        <div className="admin-surface__copy">
          <h2 className="admin-surface__title">{title}</h2>
          {description ? (
            <p className="admin-surface__description">{description}</p>
          ) : null}
        </div>
        {aside ? <div className="admin-surface__aside">{aside}</div> : null}
      </header>
      <div className="admin-surface__body">{children}</div>
    </section>
  );
}
