import { redirect } from "next/navigation";

export default function ClientBlockedSendsPage() {
  redirect("/auth/redirect");
}
