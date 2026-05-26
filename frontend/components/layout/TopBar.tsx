import type { ReactNode } from "react";
import { Bell, Search } from "lucide-react";
import { MockModeBadge } from "../shared/MockModeBadge";

interface TopBarProps {
  eyebrow?: string;
  mobileLabel?: string;
  title: string;
  actions?: ReactNode;
  leading?: ReactNode;
  isMockMode: boolean;
  showUtilityButtons?: boolean;
}

export function TopBar({
  eyebrow,
  mobileLabel,
  title,
  actions,
  leading,
  isMockMode,
  showUtilityButtons = true,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__main">
        <div className="topbar__mobile-bar">
          {leading ? <div className="topbar__leading">{leading}</div> : null}
          <div className="topbar__mobile-copy">
            {eyebrow ? <p className="topbar__mobile-eyebrow">{eyebrow}</p> : null}
            <div className="topbar__mobile-title-row">
              <strong className="topbar__mobile-title">{mobileLabel ?? title}</strong>
              {isMockMode ? <MockModeBadge /> : null}
            </div>
          </div>
        </div>
        <div className="topbar__copy">
          {eyebrow ? <p className="topbar__eyebrow">{eyebrow}</p> : null}
          <div className="topbar__title-row">
            <h1>{title}</h1>
            {isMockMode ? <MockModeBadge /> : null}
          </div>
        </div>
      </div>
      <div className="topbar__actions">
        {actions}
        {showUtilityButtons ? (
          <>
            <button
              type="button"
              className="topbar__icon-button"
              disabled
              aria-label="Ricerca non disponibile in questa milestone"
            >
              <Search aria-hidden="true" />
            </button>
            <button
              type="button"
              className="topbar__icon-button"
              disabled
              aria-label="Notifiche non disponibili in questa milestone"
            >
              <Bell aria-hidden="true" />
              <span className="topbar__indicator" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
