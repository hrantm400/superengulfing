import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import ThankYou from "../../src/pages/ThankYou";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("thankYou");

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const confirmed = url.searchParams.get("confirmed");
  if (confirmed !== "1") {
    return redirect("/");
  }
  return null;
}

export default function ThankYouPage() {
  return <ThankYou />;
}
