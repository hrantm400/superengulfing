import type { MetaFunction } from "@remix-run/node";
import ThankYou from "../../src/pages/ThankYou";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("thankYou");

export default function ThankYouPage() {
  return <ThankYou />;
}
