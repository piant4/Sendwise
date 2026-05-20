import { PublicUnsubscribeCard } from "../../components/public/PublicUnsubscribeCard";
import { buildPageMetadata } from "../../components/shared/metadata";

export const metadata = buildPageMetadata("Disiscrizione");

export default function UnsubscribeFallbackPage() {
  return <PublicUnsubscribeCard />;
}
