import {
  getClientBlockedSends,
  getClientCampaigns,
  getClientMe,
  getClientUsage,
} from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const [context, campaigns, usage, blockedSends] = await Promise.all([
    getClientMe(),
    getClientCampaigns(),
    getClientUsage(),
    getClientBlockedSends(),
  ]);

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Milestone 0.5 Stub</p>
        <h1>{context.client.name}</h1>
        <p>Client ID: {context.client.id}</p>
        <p>Campaigns: {campaigns.length}</p>
        <p>Usage records: {usage.length}</p>
        <p>Blocked sends: {blockedSends.length}</p>
      </section>
    </main>
  );
}
