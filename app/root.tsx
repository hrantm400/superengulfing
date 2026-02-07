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
  const apiUrl = process.env.VITE_API_URL || process.env.API_URL || "";
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
    { title: "SuperEngulfing.io - Master the Liquidity Sweep" },
  ];
}

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "SuperEngulfing",
      url: "https://superengulfing.io",
      logo: "https://superengulfing.io/logo/superengulfing-logo-black.png",
      description: "Advanced educational tools and proprietary algorithms for financial market analysis. Master the liquidity sweep.",
    },
    {
      "@type": "WebSite",
      name: "SuperEngulfing",
      url: "https://superengulfing.io",
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
    >
      <head>
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
              <Outlet />
            </LocaleProvider>
          </UserProvider>
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
