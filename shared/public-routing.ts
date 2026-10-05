const PUBLIC_SPA_EXACT_PATHS = new Set([
  "/",
  "/products",
  "/blog",
  "/about",
  "/b2b",
  "/terms",
  "/privacy",
  "/returns",
  "/ai-assistant",
  "/chef-event",
  "/cart",
  "/checkout",
  "/merci",
  "/login",
  "/account",
]);

function isSingleSlugPath(pathname: string, route: "/products" | "/blog"): boolean {
  const match = pathname.match(route === "/products" ? /^\/products\/([^/]+)$/ : /^\/blog\/([^/]+)$/);
  if (!match || match[1] === "." || match[1] === "..") return false;

  try {
    const decodedSlug = decodeURIComponent(match[1]);
    return decodedSlug.length > 0 && !decodedSlug.includes("/") && !decodedSlug.includes("\\");
  } catch {
    return false;
  }
}

export function isPublicSpaPath(pathname: string): boolean {
  return PUBLIC_SPA_EXACT_PATHS.has(pathname)
    || isSingleSlugPath(pathname, "/products")
    || isSingleSlugPath(pathname, "/blog");
}

const PRIVATE_SPA_EXACT_PATHS = new Set(["/admin"]);
const PRIVATE_SPA_PREFIXES = [
  "/admin/",
  "/invoice/",
  "/pay/",
  "/auth/",
];

export function isPrivateSpaPath(pathname: string): boolean {
  return PRIVATE_SPA_EXACT_PATHS.has(pathname)
    || PRIVATE_SPA_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isViteInternalPath(pathname: string): boolean {
  return pathname === "/@vite/client"
    || pathname === "/@react-refresh"
    || pathname.startsWith("/@vite/")
    || pathname.startsWith("/@id/")
    || pathname.startsWith("/@fs/")
    || pathname.startsWith("/__vite")
    || pathname.startsWith("/_vite/");
}

export function isAssetPath(pathname: string): boolean {
  const lastSegment = pathname.split("/").pop() || "";
  return lastSegment.includes(".");
}