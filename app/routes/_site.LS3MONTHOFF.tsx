import type { MetaFunction } from "@remix-run/node";
import LiquidityScanLS3MonthOff from "../../src/pages/LiquidityScanLS3MonthOff";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("liquidityscan");

export default function LS3MonthOffPage() {
  return <LiquidityScanLS3MonthOff />;
}

