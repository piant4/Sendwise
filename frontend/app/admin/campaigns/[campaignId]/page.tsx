import { auth } from "@clerk/nextjs/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCampaignDetailView } from "../../../../components/admin/AdminCampaignDetailView";
import { AdminCampaignWizardShell } from "../../../../components/admin/AdminCampaignWizardShell";
import { Button } from "../../../../components/ui/button";
import {
  getAdminCampaignDetail,
  getAdminCampaignContacts,
  getAdminCampaignSummary,
  isApiError,
} from "../../../../lib/api";
import type {
  AdminCampaignContactsSummary,
  AdminCampaignDetail,
  AdminCampaignReadinessSummary,
} from "../../../../types";

export const dynamic = "force-dynamic";

interface AdminCampaignDetailPageProps {
  params: Promise<{
    campaignId: string;
  }>;
  searchParams: Promise<{
    mode?: string;
    step?: string;
  }>;
}

export default async function AdminCampaignDetailPage({
  params,
  searchParams,
}: AdminCampaignDetailPageProps) {
  const { campaignId } = await params;
  const { mode, step } = await searchParams;
  const { getToken } = await auth();
  let result:
    | {
        campaign: AdminCampaignDetail;
        summary: AdminCampaignReadinessSummary | Error;
        contacts: AdminCampaignContactsSummary | Error;
      }
    | {
        errorMessage: string;
      };

  try {
    const accessToken = await getToken();
    const campaign = await getAdminCampaignDetail(campaignId, accessToken);
    const summary = await getAdminCampaignSummary(campaignId, accessToken).catch(
      (error) =>
        error instanceof Error
          ? error
          : new Error("Sintesi campagna non disponibile."),
    );
    const contacts = await getAdminCampaignContacts(campaignId, accessToken).catch(
      (error) =>
        error instanceof Error
          ? error
          : new Error("Destinatari campagna non disponibili."),
    );

    result = { campaign, summary, contacts };
  } catch (error) {
    if (isApiError(error) && [401, 403].includes(error.status ?? 0)) {
      redirect("/auth/redirect");
    }

    result = {
      errorMessage:
        error instanceof Error
          ? error.message
          : "Impossibile caricare la campagna admin.",
    };
  }

  const isEditMode = mode === "edit";

  return (
    <main className="shell">
      <section className="admin-page-shell">
        <header className="admin-page-header">
          <div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="admin-topbar-action admin-topbar-action--secondary"
              style={{
                marginBottom: 10,
              }}
            >
              <Link href="/admin/campaigns">
                <ArrowLeft aria-hidden="true" size={14} />
                Torna alle campagne
              </Link>
            </Button>
            <p className="admin-surface__eyebrow">Admin / Campagne</p>
            <h1 className="admin-page-title">
              {"campaign" in result ? result.campaign.name : "Campagna"}
            </h1>
            <p className="admin-page-description">
              {isEditMode
                ? "Modifica operativa con uno step attivo alla volta."
                : "Dettaglio campagna con riepilogo operativo e contenuti essenziali."}
            </p>
          </div>
        </header>

        {"errorMessage" in result ? (
          <section className="admin-clients-card">
            <p className="admin-clients-feedback admin-clients-feedback--error">
              {result.errorMessage}
            </p>
          </section>
        ) : isEditMode ? (
          <AdminCampaignWizardShell
            campaign={result.campaign}
            contacts={result.contacts instanceof Error ? null : result.contacts}
            summary={result.summary instanceof Error ? null : result.summary}
            initialStep={step}
          />
        ) : (
          <AdminCampaignDetailView
            campaign={result.campaign}
            contacts={result.contacts instanceof Error ? null : result.contacts}
            summary={result.summary instanceof Error ? null : result.summary}
          />
        )}
      </section>
    </main>
  );
}
