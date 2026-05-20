import { auth } from "@clerk/nextjs/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCampaignDetailView } from "../../../../components/admin/AdminCampaignDetailView";
import { buildPageMetadata } from "../../../../components/shared/metadata";
import { AdminCampaignWizardShell } from "../../../../components/admin/AdminCampaignWizardShell";
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
export const metadata = buildPageMetadata("Dettaglio campagna");

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
        <div className="campaign-page-back">
          <Link href="/admin/campaigns" className="campaign-back-link">
            <ArrowLeft aria-hidden="true" size={14} />
            Torna alle campagne
          </Link>
        </div>
        <header className="admin-page-header campaign-page-header">
          <div>
            <p className="admin-surface__eyebrow">
              Campagne admin
            </p>
            <h1 className="admin-page-title">
              {"campaign" in result ? result.campaign.name : "Campagna"}
            </h1>
            <p className="admin-page-description">
              {"campaign" in result
                ? `${result.campaign.clientName} · ${result.campaign.subject?.trim() || "Oggetto email da completare"}`
                : isEditMode
                  ? "Configurazione campagna non disponibile."
                  : "Dettaglio campagna non disponibile."}
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
