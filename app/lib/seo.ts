import type { MetaDescriptor } from "@remix-run/node";

const SITE_NAME = "SuperEngulfing.com";
const DEFAULT_TITLE = `${SITE_NAME} - Master the Liquidity Sweep`;
const DEFAULT_DESC = "Institutional algos hunt stops below the lows. SuperEngulfing identifies the wick grab before the reversal happens.";

const SEO: Record<string, { title: string; description: string; noindex?: boolean }> = {
  home: { title: DEFAULT_TITLE, description: DEFAULT_DESC },
  access: { title: `Course Access | ${SITE_NAME}`, description: "Get free access to the full SuperEngulfing masterclass. Institutional trading systems, zero cost." },
  login: { title: `Login | ${SITE_NAME}`, description: "Log in to your SuperEngulfing dashboard." },
  book: { title: `SuperEngulfing Book | ${SITE_NAME}`, description: "Learn liquidity sweeps and smart money concepts." },
  liquidityscan: { title: `LiquidityScan | ${SITE_NAME}`, description: "Advanced liquidity detection tool for traders." },
  thankYou: { title: `Thank You | ${SITE_NAME}`, description: "Welcome to SuperEngulfing. Your resources are ready." },
  terms: { title: `Terms & Conditions | ${SITE_NAME}`, description: "Terms and conditions for SuperEngulfing services." },
  privacy: { title: `Privacy Policy | ${SITE_NAME}`, description: "Privacy policy for SuperEngulfing." },
  disclaimer: { title: `Disclaimer | ${SITE_NAME}`, description: "Trading disclaimer and risk disclosure." },
  setPassword: { title: `Set Password | ${SITE_NAME}`, description: "Set your password.", noindex: true },
  dashboard: { title: `Dashboard | ${SITE_NAME}`, description: "Your trading dashboard.", noindex: true },
  admin: { title: `Admin | ${SITE_NAME}`, description: "Admin panel.", noindex: true },
};

export function getMeta(key: keyof typeof SEO): MetaDescriptor[] {
  const s = SEO[key] ?? SEO.home;
  const arr: MetaDescriptor[] = [
    { title: s.title },
    { name: "description", content: s.description },
  ];
  if (s.noindex) {
    arr.push({ name: "robots", content: "noindex, nofollow" });
  }
  return arr;
}
