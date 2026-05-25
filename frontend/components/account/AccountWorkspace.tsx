"use client";

import Link from "next/link";
import { UserProfile } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import type { AuthMeResponse } from "@/lib/api";
import { ThemePreferenceSelector } from "@/components/theme/ThemePreferenceSelector";

interface AccountWorkspaceProps {
  authState: AuthMeResponse;
  backHref: string;
  backLabel: string;
  email: string | null;
  personalName?: string | null;
  companyName?: string | null;
  profileEditSupported: boolean;
  title: string;
  description: string;
}

export function AccountWorkspace({
  backHref,
  backLabel,
  title,
  description,
}: AccountWorkspaceProps) {
  return (
    <main className="account-page">
      <div className="account-page__glow account-page__glow--mint" />
      <div className="account-page__glow account-page__glow--aqua" />

      <div className="account-layout">
        <section className="settings-shell settings-shell--minimal" aria-label="Area account Sendwise">
          <header className="settings-header">
            <Link href={backHref} className="settings-back">
              <ArrowLeft aria-hidden="true" />
              {backLabel}
            </Link>

            <div className="settings-header__copy">
              <h1>{title}</h1>
              <p className="settings-header__description">{description}</p>
            </div>
          </header>

          <div className="settings-sections settings-sections--minimal">
            <ThemePreferenceSelector />

            <section className="settings-section settings-section--clerk" aria-labelledby="account-clerk">
              <div className="settings-section__header">
                <h2 id="account-clerk">Profilo e sicurezza</h2>
              </div>

              <div className="settings-section__body">
                <div className="account-clerk-shell">
                  <UserProfile
                    appearance={{
                      elements: {
                        rootBox: "w-full",
                        card: "bg-transparent border-0 shadow-none p-0",
                        cardBox: "w-full shadow-none",
                        navbar:
                          "bg-[color:var(--sw-surface-elevated)] border border-[color:var(--sw-border)] rounded-2xl",
                        navbarButton:
                          "text-[var(--sw-text-muted)] hover:text-[var(--sw-primary)] rounded-xl",
                        navbarButtonActive:
                          "bg-[color:var(--sw-accent-soft)] text-[var(--sw-primary)] shadow-none",
                        pageScrollBox: "p-0",
                        profilePage: "p-0",
                        profileSection:
                          "rounded-2xl border border-[color:var(--sw-border)] bg-[color:var(--sw-surface-elevated)]",
                        formButtonPrimary:
                          "bg-[var(--sw-primary)] hover:bg-[var(--sw-primary-hover)] text-white shadow-none",
                        formFieldInput:
                          "min-h-12 rounded-[14px] border border-[color:var(--sw-border-strong)] bg-[color:var(--sw-surface-elevated)] text-[var(--sw-text)]",
                        formFieldLabel: "text-[var(--sw-text-muted)]",
                        badge: "bg-[color:var(--sw-accent-soft)] text-[var(--sw-primary)]",
                        alert:
                          "rounded-2xl border border-[color:var(--sw-danger-border)] bg-[color:var(--sw-danger-surface)] text-[var(--sw-danger)]",
                        footer: "hidden",
                        headerTitle: "text-[var(--sw-text)]",
                        headerSubtitle: "text-[var(--sw-text-muted)]",
                        accordionTriggerButton:
                          "text-[var(--sw-text)] hover:text-[var(--sw-primary)]",
                        menuButton:
                          "text-[var(--sw-text-muted)] hover:text-[var(--sw-primary)]",
                      },
                    }}
                    routing="hash"
                    fallback={
                      <div className="account-clerk-shell__loading">
                        Caricamento impostazioni protette...
                      </div>
                    }
                  />
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
