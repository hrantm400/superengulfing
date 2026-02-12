import { RemixBrowser } from "@remix-run/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Use createRoot instead of hydrateRoot to avoid hydration mismatch (#418)
// caused by ThemeScript modifying DOM before React hydrates
createRoot(document).render(
  <StrictMode>
    <RemixBrowser />
  </StrictMode>
);
