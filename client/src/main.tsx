import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const publicRoot = document.getElementById("public-root");
const appRoot = document.getElementById("root")!;
if (publicRoot?.hasAttribute("data-prerender-fallback")) {
  // Keep the SEO fallback in the server response, but show the application
  // loading state instead of a differently laid-out copy before React mounts.
  publicRoot?.remove();
  appRoot.hidden = false;
}
createRoot(appRoot).render(<App />);
