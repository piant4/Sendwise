import { PublicUnsubscribeCard } from "../../../components/public/PublicUnsubscribeCard";

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
