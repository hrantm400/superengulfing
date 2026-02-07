import type { MetaFunction } from "@remix-run/node";
import Book from "../../src/pages/Book";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("book");

export default function BookPage() {
  return <Book />;
}
