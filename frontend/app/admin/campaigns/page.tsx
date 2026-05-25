import { auth } from "@clerk/nextjs/server";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCampaignCompactCard } from "../../../components/admin/AdminCampaignCompactCard";
import { buildPageMetadata } from "../../../components/shared/metadata";
import { AdminSurface } from "../../../components/admin/AdminSurface";
import { Button } from "../../../components/ui/button";
import { getAdminCampaigns, isApiError } from "../../../lib/api";
import type { AdminCampaignSummary } from "../../../types";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("Campagne Admin");

export default async function AdminCampaignsPage() {
  const { getToken } = await auth();
  let result:
    | {
        campaigns: AdminCampaignSummary[];
      }
    | {
        errorMessage: string;
      };

  try {
    const accessToken = await getToken();
    const campaigns = await getAdminCampaigns(accessToken);

    result = { campaigns };
  } catch (error) {
    if (isApiError(error) && [401, 403].includes(error.status ?? 0)) {
      redirect("/auth/redirect");
    }

    result = {
      errorMessage:
        error instanceof Error
          ? error.message
          : "Impossibile caricare la vista campagne admin.",
    };
  }

  return (
    <main className="shell">
      <section className="admin-page-shell">
        <header
          className="admin-page-header"
          style={{
            alignItems: "start",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "space-between",
          }}
        >
          <div>
            <p className="admin-surface__eyebrow">Admin</p>
            <h1 className="admin-page-title">Campagne</h1>
            <p className="admin-page-description">
              {"campaigns" in result
                ? `${result.campaigns.length.toLocaleString("it-IT")} campagne`
                : "Conteggio campagne non disponibile"}
            </p>
          </div>
          <Button
            asChild
            size="default"
            className="admin-topbar-action campaign-action campaign-action--primary"
          >
            <Link href="/admin/campaigns/new">
              <PlusCircle aria-hidden="true" className="admin-topbar-action__icon" />
              Nuova campagna
            </Link>
          </Button>
        </header>

        {"errorMessage" in result ? (
          <section className="admin-clients-card">
            <p className="admin-clients-feedback admin-clients-feedback--error">
              {result.errorMessage}
            </p>
          </section>
        ) : (
          <AdminSurface
            title="Elenco campagne"
            description="Nome, cliente, stato, indicazione leggera di readiness, blocchi registrati e ultimo aggiornamento."
            aside={
              <span className="admin-surface__eyebrow">
                {result.campaigns.length.toLocaleString("it-IT")} elementi
              </span>
            }
          >
            {result.campaigns.length === 0 ? (
              <div className="admin-empty-state">
                Nessuna campagna presente nel database corrente.
              </div>
            ) : (
              <div className="admin-record-list" style={{ gap: 14 }}>
                {result.campaigns.map((campaign) => (
                  <AdminCampaignCompactCard key={campaign.id} campaign={campaign} />
                ))}
              </div>
            )}
          </AdminSurface>
        )}
      </section>
    </main>
  );
}
