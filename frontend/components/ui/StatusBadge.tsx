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
    background: "rgba(248, 250, 252, 0.96)",
    borderColor: "rgba(148, 163, 184, 0.28)",
    color: "#334155",
  },
  success: {
    background: "#eef6ff",
    borderColor: "#bfdbfe",
    color: "#1d4ed8",
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
