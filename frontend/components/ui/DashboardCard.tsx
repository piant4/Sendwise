import type { ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  description?: string;
  value?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export function DashboardCard({
  title,
  description,
  value,
  footer,
  children,
}: DashboardCardProps) {
  return (
    <article
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 20,
      }}
    >
      <header>
        <h2 style={{ fontSize: 18, lineHeight: 1.25, margin: 0 }}>{title}</h2>
        {description ? (
          <p style={{ margin: "8px 0 0" }}>{description}</p>
        ) : null}
      </header>
      {value !== undefined && value !== null ? (
        <div
          style={{
            color: "var(--foreground)",
            fontSize: 30,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
      ) : null}
      {children ? <div>{children}</div> : null}
      {footer ? (
        <footer
          style={{
            borderTop: "1px solid var(--border)",
            color: "var(--muted)",
            fontSize: 14,
            paddingTop: 14,
          }}
        >
          {footer}
        </footer>
      ) : null}
    </article>
  );
}
