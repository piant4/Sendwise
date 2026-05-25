import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LoginContent } from "../LoginContent";
import { buildPageMetadata } from "../../../components/shared/metadata";
import { ClerkForgotPasswordShell } from "../../../components/auth/ClerkForgotPasswordShell";

export const metadata = buildPageMetadata("Login");

interface LoginPageProps {
  params: Promise<{
    login?: string[];
  }>;
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { userId } = await auth();
  const { login: loginSegments = [] } = await params;

  if (userId) {
    redirect("/auth/redirect");
  }

  if (loginSegments.length === 1 && loginSegments[0] === "forgot-password") {
    return <ClerkForgotPasswordShell />;
  }

  if (loginSegments.length > 0) {
    redirect("/login");
  }

  return <LoginContent />;
}
