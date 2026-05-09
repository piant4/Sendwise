import Link from "next/link";
import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { AccountOverviewPanel } from "../../../components/shared/AccountOverviewPanel";
import { getAuthMe } from "../../../lib/api";

interface AccountPageProps {
  params: Promise<{
    account?: string[];
  }>;
}

function getDetailCopy(segment: string) {
  if (segment === "security") {
    return {
      title: "Sicurezza account",
      description:
        "Aggiorna password, verifica in due passaggi e sessioni attive senza uscire dal perimetro protetto di Clerk.",
    };
  }

  return {
    title: "Email e accesso",
    description:
      "Aggiorna profilo, email e metodi di accesso mantenendo Clerk come fonte di verita per le impostazioni sensibili.",
  };
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { getToken, userId } = await auth();
  const { account: accountSegments = [] } = await params;

  if (!userId) {
    redirect("/login");
  }

  const activeSegment = accountSegments[0] ?? null;
  const detailSegment =
    activeSegment === "account" || activeSegment === "security"
      ? activeSegment
      : null;
  const accessToken = await getToken();

  let backHref = "/auth/redirect";
  let accountContextLabel = "Accesso Sendwise";

  try {
    const authMe = await getAuthMe(accessToken);

    if (authMe.access_type === "platform_admin") {
      backHref = "/admin";
      accountContextLabel = "Ambiente admin";
    } else {
      accountContextLabel = "Workspace cliente";

      if (
        authMe.status === "active" &&
        !authMe.onboarding_required &&
        authMe.portal_slug
      ) {
        backHref = `/c/${authMe.portal_slug}`;
      }
    }
  } catch {
    backHref = "/auth/redirect";
  }

  const detailCopy = detailSegment ? getDetailCopy(detailSegment) : null;

  return (
    <main className="account-page">
      <div className="account-page__glow account-page__glow--mint" />
      <div className="account-page__glow account-page__glow--aqua" />

      <div className="account-layout">
        <section className="account-hero">
          <Link href={backHref} className="account-back-link">
            <ArrowLeft aria-hidden="true" />
            Torna alla dashboard
          </Link>
          <p className="account-hero__eyebrow">Area riservata</p>
          <h1 className="account-hero__title">Account Sendwise</h1>
          <p className="account-hero__lead">
            Un punto di controllo piu chiaro per profilo, email, sicurezza e
            sessione, con Clerk che continua a gestire le operazioni sensibili.
          </p>
        </section>

        {detailCopy ? (
          <section className="account-surface account-detail-card" aria-label={detailCopy.title}>
            <div className="account-surface__header">
              <span className="account-surface__badge">Dettaglio protetto</span>
              <div className="account-surface__copy">
                <h2>{detailCopy.title}</h2>
                <p>{detailCopy.description}</p>
              </div>
            </div>

            <div className="account-detail-shell">
              <div className="account-detail-shell__header">
                <p>Le modifiche qui sotto continuano a essere gestite da Clerk.</p>
                <Link href="/account" className="account-secondary-link">
                  Torna indietro
                </Link>
              </div>
              <div className="account-detail-shell__profile">
                <UserProfile path="/account" routing="path" />
              </div>
            </div>
          </section>
        ) : (
          <AccountOverviewPanel accountContextLabel={accountContextLabel} />
        )}
      </div>
    </main>
  );
}
