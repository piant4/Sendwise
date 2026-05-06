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
      {!compact ? <span className="brand-mark__word">Sendwise</span> : null}
    </div>
  );
}
