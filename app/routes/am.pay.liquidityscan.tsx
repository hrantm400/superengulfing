import type { MetaFunction } from "@remix-run/node";
import PayLiquidityScanPage from "../../src/pages/PayLiquidityScanPage";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("liquidityscan");

export default function PayLiquidityScanRouteAm() {
  return <PayLiquidityScanPage />;
}
