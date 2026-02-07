import type { MetaFunction } from "@remix-run/node";
import Home from "../../src/pages/Home";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("home");

export default function AmIndex() {
  return <Home />;
}
