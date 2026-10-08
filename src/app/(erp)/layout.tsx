import { redirect } from "next/navigation";

import { ErpProvider } from "@/lib/erp/store";
import { loadErpData } from "@/lib/erp/queries";
import { isTeam } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { Sidebar } from "@/components/erp/Sidebar";

/** The ERP shell: dark-olive sidebar + scrolling cream canvas. Staff only;
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
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1160px] px-8 pb-12 pt-7">{children}</div>
        </div>
      </div>
    </ErpProvider>
  );
}
