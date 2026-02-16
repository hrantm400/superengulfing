import type { LoaderFunctionArgs } from "@remix-run/node";

const SITE_URL = process.env.VITE_SITE_URL || process.env.SITE_URL || "https://superengulfing.com";

export async function loader({ request }: LoaderFunctionArgs) {
  const txt = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /am/dashboard
Disallow: /admin
Disallow: /am/admin
Disallow: /admin2admin10
Disallow: /am/admin2admin10
Disallow: /set-password

Sitemap: ${SITE_URL}/sitemap.xml
`;

  return new Response(txt, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
