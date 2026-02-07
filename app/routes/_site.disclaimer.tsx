import type { MetaFunction } from "@remix-run/node";
import Disclaimer from "../../src/pages/Disclaimer";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("disclaimer");

export default function DisclaimerPage() {
  return <Disclaimer />;
}
