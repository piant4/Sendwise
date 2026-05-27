"use client";

import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";

function getAccountLabel(fullName: string | null | undefined, email: string) {
  if (fullName && fullName.trim().length > 0) {
    return fullName.trim();
  }

  return email || "Account";
}

function getAccountInitials(fullName: string | null | undefined, email: string) {
  const source =
    fullName && fullName.trim().length > 0 ? fullName : email || "Account";
  const parts = source
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

interface SidebarAccountPanelProps {
  accountHref: string;
  isMockMode?: boolean;
  onAction?: () => void;
  variant?: "default" | "mobile";
}

export function SidebarAccountPanel({
  accountHref,
  isMockMode = false,
  onAction,
  variant = "default",
}: SidebarAccountPanelProps) {
  const { signOut } = useClerk();
  const { isLoaded, isSignedIn, user } = useUser();
  const showMeta = isMockMode && variant === "default";

  if (!isLoaded || !isSignedIn || !user) {
    return showMeta ? (
      <div className="sidebar-account__meta">
        <span>Sessione protetta</span>
        <span>Gestione account e sicurezza tramite Clerk.</span>
      </div>
    ) : null;
  }

  const email = user.primaryEmailAddress?.emailAddress ?? "Nessuna email";
  const label = getAccountLabel(user.fullName, email);
  const initials = getAccountInitials(user.fullName, email);

  return (
    <div className="sidebar-account-panel" data-variant={variant}>
      <div className="sidebar-account__identity">
        <div className="sidebar-account__avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="sidebar-account__copy">
          <span>{label}</span>
          <span>{email}</span>
        </div>
      </div>
      <div className="sidebar-account__actions">
        <Link
          href={accountHref}
          className="sidebar-account__action sidebar-account__action--secondary"
          prefetch
          onClick={() => onAction?.()}
          onNavigate={onAction}
        >
          {variant === "mobile" ? "Account" : "Gestisci account"}
        </Link>
        <button
          type="button"
          className="sidebar-account__action sidebar-account__action--danger"
          onClick={() => {
            onAction?.();
            void signOut({ redirectUrl: "/login" });
          }}
        >
          Esci
        </button>
      </div>
      {showMeta ? (
        <div className="sidebar-account__meta">
          <span>Modalita mock attiva</span>
          <span>Autenticazione Clerk reale, dati operativi simulati.</span>
        </div>
      ) : null}
    </div>
  );
}
