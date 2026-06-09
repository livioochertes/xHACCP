/**
 * Auto-formats a plain-text (or lightly-HTML) product description
 * into clean HTML with paragraphs, bullet lists and callout notes.
 *
 * Handles:
 *  - Blocks separated by blank lines -> distinct <p> groups
 *  - Each line within a block -> its own <p>
 *  - Lines starting with -, *, bullet unicode, or digits+dot -> ul/ol
 *  - ALL-CAPS lines -> <strong> label
 *  - ATTENTION/NOTE/IMPORTANT lines -> amber callout box
 *  - Already-HTML -> returned as-is
 */

const CALLOUT_RE = /^(attention|note|important|avertissement|atentie|hinweis|nota|aviso)\b/i;
// Matches: hyphen, en-dash (U+2013), em-dash (U+2014), bullet (U+2022), asterisk
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
      } else if (/^[A-Z\s\d!?,:]{5,}$/.test(trimmed)) {
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

export function formatProductDescription(raw: string): string {
  if (!raw || !raw.trim()) return '';

  if (looksLikeHtml(raw)) return raw;

  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const blocks = text.split(/\n{2,}/);
  const parts: string[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const rendered = renderLines(lines);
    if (rendered) parts.push(rendered);
  }

  return parts.join('');
}

export function stripFormatting(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
