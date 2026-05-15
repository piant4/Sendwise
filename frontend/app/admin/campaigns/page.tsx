import { auth } from "@clerk/nextjs/server";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCampaignCompactCard } from "../../../components/admin/AdminCampaignCompactCard";
import { AdminSurface } from "../../../components/admin/AdminSurface";
import { Button } from "../../../components/ui/button";
import {
  getAdminCampaigns,
  getAdminCampaignSummary,
  isApiError,
} from "../../../lib/api";
import type {
  AdminCampaignReadinessSummary,
  AdminCampaignSummary,
} from "../../../types";

export const dynamic = "force-dynamic";

async function loadCampaignReadiness(
  campaigns: AdminCampaignSummary[],
  accessToken: string | null,
): Promise<Record<string, AdminCampaignReadinessSummary | Error>> {
  const entries = await Promise.all(
    campaigns.map(async (campaign) => {
      try {
        return [
          campaign.id,
          await getAdminCampaignSummary(campaign.id, accessToken),
        ] as const;
      } catch (error) {
        return [
          campaign.id,
          error instanceof Error
            ? error
            : new Error("Read model campagna non disponibile."),
        ] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

export default async function AdminCampaignsPage() {
  const { getToken } = await auth();
  let result:
    | {
        campaigns: AdminCampaignSummary[];
        campaignReadiness: Record<string, AdminCampaignReadinessSummary | Error>;
      }
    | {
        errorMessage: string;
      };

  try {
    const accessToken = await getToken();
    const campaigns = await getAdminCampaigns(accessToken);
    const campaignReadiness = await loadCampaignReadiness(campaigns, accessToken);

    result = { campaigns, campaignReadiness };
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
              Vista compatta per aprire rapidamente il dettaglio di ogni campagna.
            </p>
            <p className="admin-page-description">
              {"campaigns" in result
                ? `${result.campaigns.length.toLocaleString("it-IT")} campagne`
                : "Conteggio campagne non disponibile"}
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="admin-topbar-action campaign-page-action"
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
            description="Nome, cliente, stato, readiness breve, destinatari e ultimo aggiornamento."
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
                  <AdminCampaignCompactCard
                    key={campaign.id}
                    campaign={campaign}
                    readiness={result.campaignReadiness[campaign.id]}
                  />
                ))}
              </div>
            )}
          </AdminSurface>
        )}
      </section>
    </main>
  );
}
