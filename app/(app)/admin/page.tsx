import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TopBar } from "@/components/shell/TopBar";
import { can } from "@/lib/access";
import { logBlocked } from "@/lib/audit";
import { getSession } from "@/lib/session";

// Placeholder: The Admin screen arrives in Step 10. Admins only (audit_export).
export default function AdminPage() {
  return (
    <Suspense>
      <AdminScreen />
    </Suspense>
  );
}

async function AdminScreen() {
  const session = await getSession();
  if (!session) redirect("/");
  if (!can(session.role, "audit_export")) {
    await logBlocked(session, "Tried to open the audit log", { type: "admin", label: "Admin" }, { via: "page" });
    redirect("/dashboard");
  }
  return <TopBar section="ADMIN" title="Admin" />;
}
