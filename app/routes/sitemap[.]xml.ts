import type { LoaderFunctionArgs } from "@remix-run/node";

const SITE_URL = process.env.VITE_SITE_URL || process.env.SITE_URL || "https://superengulfing.com";

const PUBLIC_PATHS = [
  "",
  "/course-access",
  "/login",
  "/book",
  "/liquidityscan",
  "/thank-you",
  "/terms",
  "/privacy",
  "/disclaimer",
];

export async function loader({ request }: LoaderFunctionArgs) {
  const urls: string[] = [];
  for (const path of PUBLIC_PATHS) {
    urls.push(`${SITE_URL}${path || "/"}`);
  }
  for (const path of PUBLIC_PATHS) {
    urls.push(`${SITE_URL}/am${path || ""}`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc><changefreq>weekly</changefreq></url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
