import { PublicUnsubscribeCard } from "../../../components/public/PublicUnsubscribeCard";
import { buildPageMetadata } from "../../../components/shared/metadata";

export const metadata = buildPageMetadata("Disiscrizione");

interface UnsubscribePageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function UnsubscribePage({
  params,
}: UnsubscribePageProps) {
  const { token } = await params;

  return <PublicUnsubscribeCard token={token} />;
}
