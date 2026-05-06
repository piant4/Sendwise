interface MockModeBadgeProps {
  className?: string;
}

export function MockModeBadge({ className }: MockModeBadgeProps) {
  const classes = ["mock-mode-badge", className].filter(Boolean).join(" ");

  return (
    <span className={classes} title="Modalità mock">
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <circle
          cx="5"
          cy="5"
          r="3"
          fill="none"
          stroke="currentColor"
          strokeDasharray="2 2"
          strokeWidth="1.2"
        />
      </svg>
      <span>Modalità mock</span>
    </span>
  );
}
