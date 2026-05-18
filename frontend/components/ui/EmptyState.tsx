import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        border: "1px dashed var(--border)",
        borderRadius: 8,
        padding: 20,
      }}
    >
      <h2 style={{ fontSize: 18, lineHeight: 1.25, margin: 0 }}>{title}</h2>
      {description ? <p style={{ margin: "8px 0 0" }}>{description}</p> : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}
