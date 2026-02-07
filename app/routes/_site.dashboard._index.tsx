import type { MetaFunction } from "@remix-run/node";
import Dashboard from "../../src/pages/Dashboard";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("dashboard");

export default function DashboardIndex() {
  return <Dashboard />;
}
