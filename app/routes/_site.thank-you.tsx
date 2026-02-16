import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import ThankYou from "../../src/pages/ThankYou";
import { getMeta } from "~/lib/seo";

export const meta: MetaFunction = () => getMeta("thankYou");

const getApiBase = () =>
  typeof process !== "undefined" && process.env?.API_URL
    ? process.env.API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:3001";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return redirect("/");
  }
  try {
    const apiBase = getApiBase();
    const res = await fetch(
      `${apiBase}/api/thank-you-access?token=${encodeURIComponent(token)}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || !data?.locale) {
      return redirect("/");
    }
    return { locale: data.locale as "en" | "am" };
  } catch {
    return redirect("/");
  }
}

export default function ThankYouPage() {
  const data = useLoaderData<typeof loader>();
  return <ThankYou localeFromLoader={data?.locale} />;
}
