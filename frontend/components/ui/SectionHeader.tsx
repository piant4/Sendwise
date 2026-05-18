import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function SectionHeader({
  title,
  description,
  actions,
}: SectionHeaderProps) {
  return (
    <header
      style={{
        alignItems: "flex-start",
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        justifyContent: "space-between",
      }}
    >
      <div>
        <p className="eyebrow">Sendwise</p>
        <h1>{title}</h1>
        {description ? <p style={{ margin: 0 }}>{description}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
