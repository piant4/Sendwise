interface AdminProgressBarProps {
  label: string;
  valueLabel: string;
  ratio: number;
  helper?: string;
  tone?: "default" | "success" | "warning" | "danger";
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 1));
}

export function AdminProgressBar({
  label,
  valueLabel,
  ratio,
  helper,
  tone = "default",
}: AdminProgressBarProps) {
  const safeRatio = clampRatio(ratio);

  return (
    <div className="admin-progress-block" data-tone={tone}>
      <div className="admin-progress-block__header">
        <span>{label}</span>
        <strong>{valueLabel}</strong>
      </div>
      <div
        className="admin-progress"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeRatio * 100)}
      >
        <div
          className="admin-progress__fill"
          style={{ width: `${safeRatio * 100}%` }}
        />
      </div>
      {helper ? <p className="admin-kpi-card__note">{helper}</p> : null}
    </div>
  );
}
