import type { MetaFunction } from "@remix-run/node";
import SiteLayout from "../../src/components/SiteLayout";

const SITE_URL = process.env.VITE_SITE_URL || process.env.SITE_URL || "https://superengulfing.com";

export const meta: MetaFunction = ({ location }) => {
  const href = SITE_URL + location.pathname;
  return [{ tagName: "link", rel: "canonical", href }];
};

export default function SiteLayoutRoute() {
  return <SiteLayout />;
}
