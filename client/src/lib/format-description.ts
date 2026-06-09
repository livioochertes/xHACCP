/**
 * Auto-formats a plain-text (or lightly-HTML) product description
 * into clean HTML with paragraphs, bullet lists and callout notes.
 */

const CALLOUT_RE = /^(attention|note|important|avertissement|atentie|atentie|hinweis|nota|aviso)\b/i;
const BULLET_RE = /^(\s*[-\u2022*\u2013\u2014]\s+)/;
const ORDERED_RE = /^(\s*\d+[.)]\s+)/;
const ALLCAPS_RE = /^[A-Z\u0102\u0103\u00C2\u00E2\u00CE\u00EE\u015E\u015F\u0162\u0163\u00C0-\u00D6\u00D8-\u00DE\s\d!?,:]{4,}$/;

function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

export function formatProductDescription(raw: string): string {
  if (!raw || !raw.trim()) return '';

  // If already HTML, return as-is
  if (looksLikeHtml(raw)) return raw;

  // Normalise line endings
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into blocks by blank lines
  const blocks = text.split(/\n{2,}/);
  const parts: string[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Callout block
    if (CALLOUT_RE.test(lines[0])) {
      const content = lines.map(l => escapeHtml(l)).join(' ');
      parts.push(`<div class="product-callout">${content}</div>`);
      continue;
    }

    // Pure bullet list
    if (lines.length > 1 && lines.every(l => BULLET_RE.test(l))) {
      const items = lines
        .map(l => `<li>${escapeHtml(l.replace(BULLET_RE, ''))}</li>`)
        .join('');
      parts.push(`<ul>${items}</ul>`);
      continue;
    }

    // Pure ordered list
    if (lines.length > 1 && lines.every(l => ORDERED_RE.test(l))) {
      const items = lines
        .map(l => `<li>${escapeHtml(l.replace(ORDERED_RE, ''))}</li>`)
        .join('');
      parts.push(`<ol>${items}</ol>`);
      continue;
    }

    // Mixed block — line by line
    let html = '';
    let inUl = false;
    let inOl = false;

    for (const line of lines) {
      if (BULLET_RE.test(line)) {
        if (inOl) { html += '</ol>'; inOl = false; }
        if (!inUl) { html += '<ul>'; inUl = true; }
        html += `<li>${escapeHtml(line.replace(BULLET_RE, ''))}</li>`;
      } else if (ORDERED_RE.test(line)) {
        if (inUl) { html += '</ul>'; inUl = false; }
        if (!inOl) { html += '<ol>'; inOl = true; }
        html += `<li>${escapeHtml(line.replace(ORDERED_RE, ''))}</li>`;
      } else {
        if (inUl) { html += '</ul>'; inUl = false; }
        if (inOl) { html += '</ol>'; inOl = false; }
        if (ALLCAPS_RE.test(line)) {
          html += `<p><strong>${escapeHtml(line)}</strong></p>`;
        } else {
          html += `<p>${escapeHtml(line)}</p>`;
        }
      }
    }
    if (inUl) html += '</ul>';
    if (inOl) html += '</ol>';

    parts.push(html);
  }

  return parts.join('');
}

/** Strip all HTML tags — returns plain text for previews / SEO */
export function stripFormatting(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
