import { UserProfile } from "@clerk/nextjs";

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(110,231,183,0.18),transparent_28%),linear-gradient(180deg,#06131b_0%,#071923_44%,#091f29_100%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-start justify-center">
        <UserProfile path="/account" routing="path" />
      </div>
    </main>
  );
}
