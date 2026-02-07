import type { MetaFunction } from "@remix-run/node";
import Terms from "../../src/pages/Terms";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("terms");

export default function TermsPage() {
  return <Terms />;
}
