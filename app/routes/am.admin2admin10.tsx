import { AdminAuthProvider } from "../../src/contexts/AdminAuthContext";
import AdminGate from "../../src/components/AdminGate";

export default function AmAdmin2Admin10() {
  return (
    <AdminAuthProvider>
      <AdminGate />
    </AdminAuthProvider>
  );
}
