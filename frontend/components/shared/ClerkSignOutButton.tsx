"use client";

import { useClerk } from "@clerk/nextjs";
import type { ReactNode } from "react";

interface ClerkSignOutButtonProps {
  className?: string;
  children: ReactNode;
}

export function ClerkSignOutButton({
  className,
  children,
}: ClerkSignOutButtonProps) {
  const { signOut } = useClerk();

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        void signOut({ redirectUrl: "/login" });
      }}
    >
      {children}
    </button>
  );
}
