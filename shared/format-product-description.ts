/**
 * Converts plain-text product descriptions into safe, minimal HTML.
 *
 * The product editor still stores the original text so it remains easy to
 * edit. This output is used for the storefront representation.
 */
const CALLOUT_RE = /^(attention|note|important|avertissement|atentie|hinweis|nota|aviso)\b/i;
const BULLET_RE = /^(\s*[-\u2013\u2014\u2022*]\s+)/;
const ORDERED_RE = /^(\s*\d+[.)]\s+)/;

function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLines(lines: string[]): string {
  let html = '';
  let inUl = false;
  let inOl = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (BULLET_RE.test(trimmed)) {
      if (inOl) { html += '</ol>'; inOl = false; }
      if (!inUl) { html += '<ul>'; inUl = true; }
      html += `<li>${escapeHtml(trimmed.replace(BULLET_RE, ''))}</li>`;
    } else if (ORDERED_RE.test(trimmed)) {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (!inOl) { html += '<ol>'; inOl = true; }
      html += `<li>${escapeHtml(trimmed.replace(ORDERED_RE, ''))}</li>`;
    } else {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (inOl) { html += '</ol>'; inOl = false; }

      if (CALLOUT_RE.test(trimmed)) {
        html += `<div class="product-callout">${escapeHtml(trimmed)}</div>`;
      } else if (/^[A-Z\s\d!?,:]{5,}$/.test(trimmed) || /^[^.!?]{2,100}:$/.test(trimmed)) {
        html += `<p><strong>${escapeHtml(trimmed)}</strong></p>`;
      } else {
        html += `<p>${escapeHtml(trimmed)}</p>`;
      }
    }
  }

  if (inUl) html += '</ul>';
  if (inOl) html += '</ol>';
  return html;
}

export function formatProductDescription(raw: string, productName?: string): string {
  if (!raw || !raw.trim()) return '';
  if (looksLikeHtml(raw)) return raw;

  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let html = text
    .split(/\n{2,}/)
    .map(block => renderLines(block.split('\n')))
    .filter(Boolean)
    .join('');

  const escapedProductName = escapeHtml(productName?.trim() || '');
  if (escapedProductName && !html.includes(`<strong>${escapedProductName}</strong>`)) {
    html = html.replace(escapedProductName, `<strong>${escapedProductName}</strong>`);
  }

  return html;
}

export function stripFormatting(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}