import type { ReactNode } from "react";
import { Bell, Search } from "lucide-react";
import { MockModeBadge } from "../shared/MockModeBadge";

interface TopBarProps {
  title: string;
  breadcrumb?: string[];
  actions?: ReactNode;
  leading?: ReactNode;
}

export function TopBar({
  title,
  breadcrumb,
  actions,
  leading,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__main">
        {leading ? <div className="topbar__leading">{leading}</div> : null}
        <div className="topbar__copy">
          {breadcrumb?.length ? (
            <div className="topbar__breadcrumb" aria-label="Breadcrumb">
              {breadcrumb.map((item, index) => (
                <span key={`${item}-${index}`}>
                  {item}
                  {index < breadcrumb.length - 1 ? (
                    <span className="topbar__breadcrumb-separator" aria-hidden="true">
                      /
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
          <div className="topbar__title-row">
            <h1>{title}</h1>
            <MockModeBadge />
          </div>
        </div>
      </div>
      <div className="topbar__actions">
        {actions}
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
      </div>
    </header>
  );
}
