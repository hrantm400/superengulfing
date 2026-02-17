import type { MetaFunction } from "@remix-run/node";
import LiquidityScan from "../../src/pages/LiquidityScan";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("liquidityscan");

export default function LS3MonthOffPage() {
  return <LiquidityScan />;
}

