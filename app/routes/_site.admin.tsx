import type { MetaFunction } from "@remix-run/node";
import { AdminAuthProvider } from "../../src/contexts/AdminAuthContext";
import AdminGate from "../../src/components/AdminGate";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("admin");

export default function Admin() {
  return (
    <AdminAuthProvider>
      <AdminGate />
    </AdminAuthProvider>
  );
}
