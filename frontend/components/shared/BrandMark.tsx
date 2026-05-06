interface BrandMarkProps {
  className?: string;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
}

export function BrandMark({
  className,
  compact = false,
  size = "md",
}: BrandMarkProps) {
  const classes = ["brand-mark", `brand-mark--${size}`, compact ? "brand-mark--compact" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <span className="brand-mark__symbol" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path
            d="M2 4.5H14M2 8H10M2 11.5H14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="13.5" cy="8" r="1.5" fill="currentColor" />
        </svg>
      </span>
      {!compact ? <span className="brand-mark__word">Sendwise</span> : null}
    </div>
  );
}
