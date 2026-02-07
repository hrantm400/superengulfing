import type { MetaFunction } from "@remix-run/node";
import Access from "../../src/pages/Access";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("access");

export default function CourseAccess() {
  return <Access />;
}
