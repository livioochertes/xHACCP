export const VIVA_USER_AGENT = "xHACCP/1.0";

export function withVivaUserAgent(headers: Record<string, string> = {}) {
  return {
    ...headers,
    "User-Agent": VIVA_USER_AGENT,
  };
}
