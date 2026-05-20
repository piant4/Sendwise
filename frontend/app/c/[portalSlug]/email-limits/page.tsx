import { redirect } from "next/navigation";

interface ClientEmailLimitsPageProps {
  params: Promise<{
    portalSlug: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function ClientEmailLimitsPage({
  params,
}: ClientEmailLimitsPageProps) {
  const { portalSlug } = await params;
  redirect(`/c/${portalSlug}/account`);
}
