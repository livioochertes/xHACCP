/** One host policy for public canonicals, structured data and sitemaps. */
export function canonicalBaseUrl(req: { headers: Record<string, unknown> }): string {
  const raw = req.headers["x-forwarded-host"] || req.headers.host || "xhaccp.ro";
  const host = String(Array.isArray(raw) ? raw[0] : raw).split(",")[0].trim().toLowerCase().replace(/^www\./, "");
  // Never interpolate an unvalidated header into HTML/XML.
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host)) return "https://xhaccp.ro";
  return `https://${host}`;
}