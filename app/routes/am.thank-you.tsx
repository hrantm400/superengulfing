import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import ThankYou from "../../src/pages/ThankYou";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const confirmed = url.searchParams.get("confirmed");
  if (confirmed !== "1") {
    return redirect("/am");
  }
  return null;
}

export default function AmThankYou() {
  return <ThankYou />;
}
