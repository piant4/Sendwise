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
    background: "#f8fafc",
    borderColor: "var(--border)",
    color: "var(--muted)",
  },
  success: {
    background: "#ecfdf3",
    borderColor: "#abefc6",
    color: "#067647",
  },
  warning: {
    background: "#fffaeb",
    borderColor: "#fedf89",
    color: "#b54708",
  },
  danger: {
    background: "#fef3f2",
    borderColor: "#fecdca",
    color: "#b42318",
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
        borderRadius: 999,
        color: style.color,
        display: "inline-flex",
        fontSize: 13,
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
