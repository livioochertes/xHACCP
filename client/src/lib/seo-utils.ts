export function toSeoText(text: string): string {
  return text.replace(/xHACCP/gi, "HACCP");
}

export function truncateDesc(text: string, maxLen = 155): string {
  if (!text) return "";
  const cleaned = text.replace(/<[^>]+>/g, "").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 3) + "...";
}
