import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LoginContent } from "../LoginContent";

export default async function LoginPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/admin");
  }

  return <LoginContent />;
}
