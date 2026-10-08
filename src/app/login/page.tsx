import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StaffSignIn } from "@/components/erp/StaffSignIn";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in — AFEMS",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user.role === "staff") redirect("/");
  if (session) redirect("/portal");
  return <StaffSignIn />;
}
