import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LoginContent } from "../LoginContent";
import { buildPageMetadata } from "../../../components/shared/metadata";

export const metadata = buildPageMetadata("Login");

export default async function LoginPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/auth/redirect");
  }

  return <LoginContent />;
}
