import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";

import { ThemeProvider } from "../src/contexts/ThemeContext";
import { UserProvider } from "../src/contexts/UserContext";
import { LocaleProvider } from "../src/contexts/LocaleContext";
import SetDocumentLang from "../src/components/SetDocumentLang";
import ScrollToTop from "../src/components/ScrollToTop";
import VisitorHeartbeat from "../src/components/VisitorHeartbeat";

import tailwindStyles from "./tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: tailwindStyles },
  { rel: "icon", type: "image/png", href: "/logo/se-favicon.png" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Armenian:wght@300;400;500;600;700&display=swap",
  },
];

export async function loader(_args: LoaderFunctionArgs) {
  let apiUrl = process.env.VITE_API_URL || process.env.API_URL || "";
  // Avoid double /api: code appends /api/... to base URL, so base must not end with /api
  if (apiUrl.endsWith("/api")) {
    apiUrl = apiUrl.slice(0, -4);
  }
  return {
    env: {
      API_URL: apiUrl,
    },
  };
}

export function meta() {
  return [
    { charset: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5" },
    { title: "SuperEngulfing.com - Master the Liquidity Sweep" },
  ];
}

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "SuperEngulfing",
      url: "https://superengulfing.com",
      logo: "https://superengulfing.com/logo/superengulfing-logo-black.png",
      description: "Advanced educational tools and proprietary algorithms for financial market analysis. Master the liquidity sweep.",
    },
    {
      "@type": "WebSite",
      name: "SuperEngulfing",
      url: "https://superengulfing.com",
      description: "Master the Liquidity Sweep. Institutional algos hunt stops—SuperEngulfing identifies the wick grab before the reversal.",
    },
  ],
};

function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var theme = localStorage.getItem('theme');
            if (theme === 'light' || theme === 'dark') {
              document.documentElement.classList.toggle('dark', theme === 'dark');
            } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
              document.documentElement.classList.remove('dark');
            } else {
              document.documentElement.classList.add('dark');
            }
          })();
        `,
      }}
    />
  );
}

export default function App() {
  const data = useLoaderData<typeof loader>();

  return (
    <html
      lang="en"
      className="text-foreground font-display min-h-screen flex flex-col overflow-x-hidden selection:bg-primary selection:text-black"
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5" />
        <meta name="google-site-verification" content="phObeDb8UJ29dMEbXPRhHqtRVnRRDh15trtvFXZ_hEc" />
        <ThemeScript />
        <Meta />
        <Links />
        {typeof data?.env !== "undefined" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.ENV = ${JSON.stringify(data.env)};`,
            }}
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>
        <ThemeProvider>
          <UserProvider>
            <LocaleProvider>
              <SetDocumentLang />
              <ScrollToTop />
              <VisitorHeartbeat />
              <Outlet />
            </LocaleProvider>
          </UserProvider>
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
        {/* Tawk.to live chat */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
              (function(){
                var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
                s1.async=true;
                s1.src='https://embed.tawk.to/699c2505d737701c38a63b02/1ji4v1794';
                s1.charset='UTF-8';
                s1.setAttribute('crossorigin','*');
                s0.parentNode.insertBefore(s1,s0);
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
