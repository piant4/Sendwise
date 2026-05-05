import { getMockClientCampaigns, getMockClientUsage } from "../../lib/mock-api";

export default function ClientPage() {
  const campaigns = getMockClientCampaigns();
  const usage = getMockClientUsage();

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">V1 Skeleton</p>
        <h1>Client Dashboard Placeholder</h1>
        <p>
          Client data is scoped through mock helpers for now. Future real data
          must come from backend APIs and remain isolated by client_id.
        </p>
        <p>Mock campaigns: {campaigns.length}</p>
        <p>Mock API usage quantity: {usage.quantity}</p>
      </section>
    </main>
  );
}
