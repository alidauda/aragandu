import { redirect } from "next/navigation";

import { ErpProvider } from "@/lib/erp/store";
import { loadErpData } from "@/lib/erp/queries";
import { isTeam } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { Shell } from "@/components/erp/Shell";

/** The ERP shell: white sidebar and top bar around the page. Staff only;
 *  every screen inside reads the ledgers loaded here, fresh per request. */
export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isTeam(session.user.role) || session.user.disabled) redirect("/portal");

  const data = await loadErpData({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role === "admin" ? "admin" : "staff",
  });

  return (
    <ErpProvider data={data}>
      <Shell>{children}</Shell>
    </ErpProvider>
  );
}
