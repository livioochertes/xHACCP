import { load } from "cheerio";
import { formatProductDescription } from "@shared/format-product-description";

export function escapePublicText(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Preserve semantic content without exposing stored executable HTML. */
export function sanitizePublicHtml(html: string): string {
  const $ = load(html, {}, false);
  const allowed = new Set("p h1 h2 h3 h4 h5 h6 ul ol li strong b em i code pre blockquote a img table thead tbody tr th td caption figure figcaption br hr dl dt dd div span".split(" "));
  $("script,style,iframe,object,embed,form,input,button,svg,math,template").remove();
  $("*").each((_, el) => {
    if (el.type !== "tag") return;
    if (!allowed.has(el.name)) {
      $(el).replaceWith($(el).contents());
      return;
    }
    for (const attribute of Object.keys(el.attribs)) {
      if (!["href", "src", "alt", "title", "colspan", "rowspan"].includes(attribute)) {
        $(el).removeAttr(attribute);
      }
    }
    for (const attribute of ["href", "src"]) {
      const value = $(el).attr(attribute);
      if (value && !/^(https?:\/\/|\/(?!\/)|#|mailto:)/i.test(value.trim())) $(el).removeAttr(attribute);
    }
  });
  return $.html();
}

export function renderProductContent(content: string, name: string): string {
  return sanitizePublicHtml(formatProductDescription(content, name));
}

export function renderArticleContent(content: string): string {
  if (/<[a-z][^>]*>/i.test(content)) return sanitizePublicHtml(content);
  let html = escapePublicText(content);
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");
  html = html.split("\n").map(line => {
    const trimmed = line.trim();
    return !trimmed || /^<(h[1-6]|ul|ol|li|blockquote)/.test(trimmed) ? trimmed : `<p>${trimmed}</p>`;
  }).join("\n");
  return sanitizePublicHtml(html);
}