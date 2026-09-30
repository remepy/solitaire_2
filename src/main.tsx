// Heebo is bundled, not fetched from Google Fonts: the page is served from its
// own S3 prefix inside a WebView (BR-12), a third-party request on the critical
// path is one more thing that can fail in the field, and Hebrew falling back to
// a system face is a visible regression for the participant.
import "@fontsource/heebo/hebrew-400.css";
import "@fontsource/heebo/hebrew-600.css";
import "@fontsource/heebo/hebrew-700.css";
import "@fontsource/heebo/latin-400.css";
import "@fontsource/heebo/latin-600.css";
import "@fontsource/heebo/latin-700.css";
import "./styles.css";

import { createRoot } from "react-dom/client";

import App from "./App";
import { ErrorBoundary } from "@/components/error-boundary";

// No service worker and no PWA manifest: the game is loaded full-window from
// its own URL by the host app's WebView (bridge spec §4), so there is nothing
// to install and a cached shell would only risk serving a stale build.
createRoot(document.getElementById("root")!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
