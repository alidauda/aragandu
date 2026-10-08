import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StaffSignIn } from "@/components/erp/StaffSignIn";
import { isTeam } from "@/lib/roles";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in — AFEMS",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const session = await getSession();
  if (session && isTeam(session.user.role) && !session.user.disabled) redirect("/");
  if (session && !session.user.disabled) redirect("/portal");
  const { created } = await props.searchParams;
  return (
    <StaffSignIn notice={created ? "Your account is ready — sign in to continue." : undefined} />
  );
}
