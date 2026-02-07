import type { MetaFunction } from "@remix-run/node";
import SetPassword from "../../src/pages/SetPassword";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("setPassword");

export default function SetPasswordPage() {
  return <SetPassword />;
}
