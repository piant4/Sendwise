type StatusBadgeVariant = "neutral" | "success" | "warning" | "danger";

interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
}

const variantStyles: Record<
  StatusBadgeVariant,
  { background: string; borderColor: string; color: string }
> = {
  neutral: {
    background: "var(--sw-badge-neutral-bg)",
    borderColor: "var(--sw-badge-neutral-border)",
    color: "var(--sw-badge-neutral-text)",
  },
  success: {
    background: "var(--sw-badge-success-bg)",
    borderColor: "var(--sw-badge-success-border)",
    color: "var(--sw-badge-success-text)",
  },
  warning: {
    background: "var(--sw-badge-warning-bg)",
    borderColor: "var(--sw-badge-warning-border)",
    color: "var(--sw-badge-warning-text)",
  },
  danger: {
    background: "var(--sw-badge-danger-bg)",
    borderColor: "var(--sw-badge-danger-border)",
    color: "var(--sw-badge-danger-text)",
  },
};

export function StatusBadge({
  label,
  variant = "neutral",
}: StatusBadgeProps) {
  const style = variantStyles[variant];

  return (
    <span
      style={{
        alignItems: "center",
        background: style.background,
        border: `1px solid ${style.borderColor}`,
        borderRadius: 10,
        color: style.color,
        display: "inline-flex",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        padding: "6px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
