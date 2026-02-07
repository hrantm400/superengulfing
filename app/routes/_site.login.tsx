import type { MetaFunction } from "@remix-run/node";
import Login from "../../src/pages/Login";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("login");

export default function LoginPage() {
  return <Login />;
}
