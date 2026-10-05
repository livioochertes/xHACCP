import { createRoot, hydrateRoot } from "react-dom/client";
import { PublicPage } from "@shared/public-page";
import App from "./App";
import "./index.css";

const publicRoot = document.getElementById("public-root");
const appRoot = document.getElementById("root")!;
const content = publicRoot?.querySelector(".public-content");
const isHomeFallback = publicRoot?.hasAttribute("data-home-fallback") ?? false;
const prerender = content && !isHomeFallback
  ? hydrateRoot(publicRoot!, <PublicPage html={content.innerHTML} />)
  : null;
if (isHomeFallback) {
  // Show the app's loading state instead of flashing the crawler-only home copy.
  publicRoot?.remove();
  appRoot.hidden = false;
}
window.addEventListener("public-page-ready", () => {
  // A ready event may come from a React effect; unmount the other root only
  // after that render/effect cycle has finished.
  queueMicrotask(() => {
    prerender?.unmount();
    publicRoot?.remove();
    appRoot.hidden = false;
  });
}, { once: true });
createRoot(appRoot).render(<App />);
