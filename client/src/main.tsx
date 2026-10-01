import { createRoot, hydrateRoot } from "react-dom/client";
import { PublicPage } from "@shared/public-page";
import App from "./App";
import "./index.css";

const publicRoot = document.getElementById("public-root");
const appRoot = document.getElementById("root")!;
const content = publicRoot?.querySelector(".public-content");
const prerender = content
  ? hydrateRoot(publicRoot!, <PublicPage html={content.innerHTML} />)
  : null;
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
