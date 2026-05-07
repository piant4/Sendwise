"use client";

import { ClerkLoaded, Show, UserButton } from "@clerk/nextjs";

export function AccountUserButton() {
  return (
    <ClerkLoaded>
      <Show when="signed-in">
        <div className="flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 shadow-[0_16px_40px_rgba(7,25,35,0.18)] backdrop-blur">
          <UserButton
            showName
            userProfileMode="navigation"
            userProfileUrl="/account"
            appearance={{
              elements: {
                avatarBox: "size-9",
                userButtonBox: "flex-row-reverse gap-3 text-white",
                userButtonTrigger:
                  "rounded-full px-1 py-0.5 text-sm font-medium text-white outline-none ring-0 transition hover:bg-white/5 focus:shadow-none",
                userButtonOuterIdentifier:
                  "max-w-[10rem] truncate text-sm font-medium text-white",
                userButtonPopoverCard:
                  "border border-white/10 bg-slate-950 text-white shadow-[0_24px_60px_rgba(3,10,14,0.42)]",
                userButtonPopoverActionButton:
                  "text-white hover:bg-white/5 focus:bg-white/5",
                userButtonPopoverActionButtonText: "text-sm font-medium",
                userButtonPopoverActionButtonIcon: "text-white/65",
                userPreviewTextContainer: "text-right",
                userPreviewMainIdentifier: "text-sm font-medium text-white",
                userPreviewSecondaryIdentifier: "text-xs text-white/55",
              },
            }}
          />
        </div>
      </Show>
    </ClerkLoaded>
  );
}
