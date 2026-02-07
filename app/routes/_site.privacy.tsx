import type { MetaFunction } from "@remix-run/node";
import Privacy from "../../src/pages/Privacy";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("privacy");

export default function PrivacyPage() {
  return <Privacy />;
}
