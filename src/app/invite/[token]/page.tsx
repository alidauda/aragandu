import type { Metadata } from "next";

import { AcceptInvite } from "@/components/AcceptInvite";
import { findOpenInvite } from "@/lib/invites";
import { asRole, isTeam } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Set up your account — Argandu Farms",
  // The URL carries a secret; keep it out of search engines and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const invite = await findOpenInvite(token);

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm rounded-2xl border border-[#dfe2d2] bg-white p-8 text-center">
          <div className="font-display text-lg font-semibold text-[#1c2214]">
            This invite link can&apos;t be used
          </div>
          <p className="mt-2 text-[13.5px] text-[#6c7359]">
            It has expired, was already used, or was replaced by a newer link.
            Ask the farm to send you a new one.
          </p>
          <p className="mt-4 text-[13px] text-[#6c7359]">
            Already set up? <a href="/portal" className="underline">Buyer portal</a> ·{" "}
            <a href="/login" className="underline">Staff sign-in</a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <AcceptInvite
      token={token}
      email={invite.email}
      name={isTeam(invite.role) ? invite.name : (invite.customer?.name ?? invite.name)}
      role={asRole(invite.role)}
    />
  );
}
